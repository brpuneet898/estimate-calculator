from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_required, current_user, login_user, logout_user
from models import User, Service, ServiceCategory, PatientCategory, Discount, db
import csv
import io

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('login.html')

@main.route('/login')
def login_page():
    return render_template('login.html')

@main.route('/signup')
def signup_page():
    return render_template('signup.html')

@main.route('/dashboard')
@login_required
def dashboard():
    # Check if user is rejected
    if current_user.rejected:
        return render_template('pending-approval.html', user=current_user, rejected=True)
    
    # Check if user is approved
    if not current_user.approved:
        return render_template('pending-approval.html', user=current_user, rejected=False)
    
    # Route to appropriate dashboard based on role
    if current_user.is_admin:
        return render_template('masters.html')
    elif current_user.is_manager:
        return render_template('manager-dashboard.html')
    else:  # regular user
        return render_template('user-dashboard.html')

# API Routes
# User approval endpoints
@main.route('/api/pending-users', methods=['GET'])
@login_required
def get_pending_users():
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
        
    pending_users = User.query.filter_by(approved=False, rejected=False).order_by(User.created_at.asc()).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'role': u.role,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M:%S')
    } for u in pending_users])

@main.route('/api/users/<int:user_id>/approve', methods=['POST'])
@login_required
def approve_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
        
    user = User.query.get_or_404(user_id)
    if user.approved:
        return jsonify({'error': 'User is already approved'}), 400

    user.approved = True
    db.session.commit()
    return jsonify({'message': 'User approved successfully'})

@main.route('/api/users/<int:user_id>/reject', methods=['POST'])
@login_required
def reject_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
        
    user = User.query.get_or_404(user_id)
    if user.approved:
        return jsonify({'error': 'Cannot reject an approved user'}), 400
    
    user.rejected = True
    db.session.commit()
    return jsonify({'message': 'User rejected successfully'})

@main.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')  # Default to 'user' if not specified
    
    if not username or not password or not role:
        return jsonify({'error': 'Username, password, and role are required'}), 400
    
    if role not in ['user', 'manager', 'admin']:
        return jsonify({'error': 'Invalid role specified'}), 400
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    # Check if there's already an admin
    if role == 'admin':
        existing_admin = User.query.filter_by(role='admin').first()
        if existing_admin:
            return jsonify({'error': 'Only one admin account is allowed'}), 400
    
    # Create user account (unapproved by default, except for the first admin)
    is_first_admin = role == 'admin' and User.query.count() == 0
    approved = is_first_admin  # First admin is auto-approved
    
    user = User(username=username, role=role, approved=approved)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    if is_first_admin:
        return jsonify({'message': 'Admin account created successfully!', 'auto_approved': True}), 201
    else:
        return jsonify({'message': 'Account created. Awaiting admin approval.', 'auto_approved': False}), 201
@main.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        # hide whether user exists; return generic message
        return jsonify({'error': 'invalid credentials'}), 401

    login_user(user)
    return jsonify({
        'id': user.id,
        'username': user.username,
        'role': user.role,
        'is_admin': user.is_admin,
        'is_manager': user.is_manager
    })

@main.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'ok'})

@main.route('/api/user-info', methods=['GET'])
@login_required
def user_info():
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'role': current_user.role,
        'is_admin': current_user.is_admin,
        'is_manager': current_user.is_manager,
        'approved': current_user.approved,
        'rejected': current_user.rejected
    })

# Services API
@main.route('/api/services', methods=['GET'])
@login_required
def get_services():
    services = Service.query.all()
    return jsonify([{
        'id': s.id,
        'name': s.name,
        'category_id': s.category_id,
        'category_name': s.category.name,
        'category_display_name': s.category.display_name,
        'cost_price': float(s.cost_price),
        'mrp': float(s.mrp),
        'is_daily_charge': s.is_daily_charge,
        'visits_per_day': s.visits_per_day
    } for s in services])

@main.route('/api/services', methods=['POST'])
@login_required
def create_service():
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    category_id = data.get('category_id')
    cost_price = data.get('cost_price')
    mrp = data.get('mrp')
    is_daily_charge = data.get('is_daily_charge', False)
    visits_per_day = data.get('visits_per_day', 1)
    
    if not name or not category_id or cost_price is None or mrp is None:
        return jsonify({'error': 'name, category_id, cost_price, and mrp are required'}), 400
    
    try:
        service = Service(
            name=name,
            category_id=category_id,
            cost_price=cost_price,
            mrp=mrp,
            is_daily_charge=is_daily_charge,
            visits_per_day=visits_per_day
        )
        db.session.add(service)
        db.session.commit()
        return jsonify({'id': service.id, 'message': 'Service created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@main.route('/api/services/<int:service_id>', methods=['PUT'])
@login_required
def update_service(service_id):
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    service = Service.query.get_or_404(service_id)
    data = request.get_json() or {}
    
    service.name = data.get('name', service.name)
    service.category_id = data.get('category_id', service.category_id)
    service.cost_price = data.get('cost_price', service.cost_price)
    service.mrp = data.get('mrp', service.mrp)
    service.is_daily_charge = data.get('is_daily_charge', service.is_daily_charge)
    service.visits_per_day = data.get('visits_per_day', service.visits_per_day)
    
    try:
        db.session.commit()
        return jsonify({'message': 'Service updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@main.route('/api/services/<int:service_id>', methods=['DELETE'])
@login_required
def delete_service(service_id):
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    service = Service.query.get_or_404(service_id)
    try:
        db.session.delete(service)
        db.session.commit()
        return jsonify({'message': 'Service deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Categories API
@main.route('/api/service-categories', methods=['GET'])
@login_required
def get_service_categories():
    categories = ServiceCategory.query.all()
    print("\n=== Service Categories from Database ===")
    for c in categories:
        print(f"ID: {c.id}, Name: {c.name}, Display Name: {c.display_name}")
    print("=====================================\n")
    
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'display_name': c.display_name
    } for c in categories])

@main.route('/api/patient-categories', methods=['GET'])
@login_required
def get_patient_categories():
    categories = PatientCategory.query.all()
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'display_name': c.display_name
    } for c in categories])

# Discounts API
@main.route('/api/discounts', methods=['GET'])
@login_required
def get_discounts():
    discounts = Discount.query.all()
    return jsonify([{
        'id': d.id,
        'patient_category_id': d.patient_category_id,
        'patient_category_name': d.patient_category.name,
        'patient_category_display': d.patient_category.display_name,
        'service_category_id': d.service_category_id,
        'service_category_name': d.service_category.name,
        'service_category_display': d.service_category.display_name,
        'discount_type': d.discount_type,
        'discount_value': float(d.discount_value)
    } for d in discounts])

@main.route('/api/discounts', methods=['POST'])
@login_required
def create_discount():
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    data = request.get_json() or {}
    required_fields = ['patient_category_id', 'service_category_id', 'discount_type', 'discount_value']
    
    if not all(data.get(field) is not None for field in required_fields):
        return jsonify({'error': 'All fields are required'}), 400
    
    if data['discount_type'] not in ['percentage', 'flat']:
        return jsonify({'error': 'discount_type must be percentage or flat'}), 400
    
    try:
        existing = Discount.query.filter_by(
            patient_category_id=data['patient_category_id'],
            service_category_id=data['service_category_id']
        ).first()
        
        if existing:
            existing.discount_type = data['discount_type']
            existing.discount_value = data['discount_value']
            message = 'Discount updated successfully'
        else:
            existing = Discount(**{k: data[k] for k in required_fields})
            db.session.add(existing)
            message = 'Discount created successfully'
        
        db.session.commit()
        return jsonify({'id': existing.id, 'message': message})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@main.route('/api/discounts/<int:discount_id>', methods=['DELETE'])
@login_required
def delete_discount(discount_id):
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    discount = Discount.query.get_or_404(discount_id)
    try:
        db.session.delete(discount)
        db.session.commit()
        return jsonify({'message': 'Discount deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@main.route('/api/discounts/<int:discount_id>', methods=['PUT'])
@login_required
def update_discount(discount_id):
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403

    discount = Discount.query.get_or_404(discount_id)
    data = request.get_json() or {}

    discount.patient_category_id = data.get('patient_category_id', discount.patient_category_id)
    discount.service_category_id = data.get('service_category_id', discount.service_category_id)
    discount.discount_type = data.get('discount_type', discount.discount_type)
    discount.discount_value = data.get('discount_value', discount.discount_value)

    try:
        db.session.commit()
        return jsonify({'message': 'Discount updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Bulk Upload API
@main.route('/api/bulk-upload/services', methods=['POST'])
@login_required
def bulk_upload_services():
    if not (current_user.is_admin or current_user.is_manager):
        return jsonify({'error': 'Admin or manager access required'}), 403
    
    csv_content = request.get_json().get('csv_content', '').strip()
    if not csv_content:
        return jsonify({'error': 'csv_content is required'}), 400
    
    try:
        category_map = {cat.name: cat.id for cat in ServiceCategory.query.all()}
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        success_count = 0
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                name = row.get('name', '').strip()
                category_name = row.get('category_name', '').strip()
                
                if not name or not category_name or category_name not in category_map:
                    errors.append(f"Row {row_num}: Invalid name or category")
                    continue
                
                service = Service(
                    name=name,
                    category_id=category_map[category_name],
                    cost_price=float(row.get('cost_price', 0)),
                    mrp=float(row.get('mrp', 0)),
                    is_daily_charge=row.get('is_daily_charge', '').lower() in ['1', 'true', 'yes'],
                    visits_per_day=int(row.get('visits_per_day', 1))
                )
                db.session.add(service)
                success_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        db.session.commit()
        return jsonify({'success_count': success_count, 'errors': errors})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@main.route('/api/bulk-upload/services/template', methods=['GET'])
@login_required
def get_services_template():
    template = "name,category_name,cost_price,mrp,is_daily_charge,visits_per_day\n"
    template += "Complete Blood Count,laboratory,200.00,300.00,false,1\n"
    template += "General Nursing Care,nursing,500.00,800.00,true,3\n"
    return jsonify({'template': template})