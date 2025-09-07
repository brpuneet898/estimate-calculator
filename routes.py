from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_required, current_user, login_user, logout_user
from models import User, Service, ServiceCategory, PatientCategory, Discount, SavedEstimate, SavedEstimateService, db
from datetime import datetime, timedelta
import csv
import io
import json
import pandas as pd

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
    
    # Check if a file was uploaded
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Check file extension
    allowed_extensions = ['.csv', '.xlsx', '.xls']
    file_extension = '.' + file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if file_extension not in allowed_extensions:
        return jsonify({'error': 'Only CSV (.csv) and Excel (.xlsx, .xls) files are allowed'}), 400
    
    try:
        # Read file content based on file type
        if file_extension == '.csv':
            # Read CSV file
            content = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content))
            rows = list(csv_reader)
        else:
            # Read Excel file
            df = pd.read_excel(file)
            rows = df.to_dict('records')
        
        # Validate required columns
        required_columns = ['name', 'category_name', 'cost_price', 'mrp', 'is_daily_charge']
        if not rows:
            return jsonify({'error': 'File is empty or has no data rows'}), 400
        
        missing_columns = []
        for col in required_columns:
            if col not in rows[0]:
                missing_columns.append(col)
        
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        # Process data
        category_map = {cat.name: cat.id for cat in ServiceCategory.query.all()}
        success_count = 0
        errors = []
        
        for row_num, row in enumerate(rows, start=2):
            try:
                name = str(row.get('name', '')).strip()
                category_name = str(row.get('category_name', '')).strip()
                
                if not name or not category_name or category_name not in category_map:
                    errors.append(f"Row {row_num}: Invalid name or category '{category_name}'")
                    continue
                
                # Convert boolean values
                is_daily_charge = str(row.get('is_daily_charge', '')).lower() in ['1', 'true', 'yes', 'True', '1.0']
                
                service = Service(
                    name=name,
                    category_id=category_map[category_name],
                    cost_price=float(row.get('cost_price', 0)),
                    mrp=float(row.get('mrp', 0)),
                    is_daily_charge=is_daily_charge,
                    visits_per_day=int(float(row.get('visits_per_day', 1)))
                )
                db.session.add(service)
                success_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        if success_count > 0:
            db.session.commit()
        
        return jsonify({
            'success_count': success_count, 
            'errors': errors,
            'message': f'Successfully processed {success_count} services'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error processing file: {str(e)}'}), 400

@main.route('/api/bulk-upload/services/template', methods=['GET'])
@login_required
def get_services_template():
    template = "name,category_name,cost_price,mrp,is_daily_charge,visits_per_day\n"
    template += "Complete Blood Count,laboratory,200.00,300.00,false,1\n"
    template += "General Nursing Care,nursing,500.00,800.00,true,3\n"
    return jsonify({'template': template})

@main.route('/api/bulk-upload/discounts', methods=['POST'])
@login_required
def bulk_upload_discounts():
    """Bulk upload discounts from CSV/Excel file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file content
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Invalid file format. Please upload CSV or Excel file.'}), 400
        
        # Convert to list of dictionaries
        rows = df.to_dict('records')
        
        if not rows:
            return jsonify({'error': 'File is empty'}), 400
        
        # Validate required columns
        required_columns = ['patient_category', 'service_category', 'discount_type', 'discount_value']
        missing_columns = []
        for col in required_columns:
            if col not in rows[0]:
                missing_columns.append(col)
        
        if missing_columns:
            return jsonify({'error': f'Missing required columns: {", ".join(missing_columns)}'}), 400
        
        # Get existing categories for validation
        service_categories = {cat.name: cat.id for cat in ServiceCategory.query.all()}
        patient_categories = {cat.name: cat.id for cat in PatientCategory.query.all()}
        
        success_count = 0
        errors = []
        
        for row_num, row in enumerate(rows, start=2):
            try:
                patient_category = str(row.get('patient_category', '')).strip()
                service_category = str(row.get('service_category', '')).strip()
                discount_type = str(row.get('discount_type', '')).strip().lower()
                discount_value = row.get('discount_value', 0)
                
                # Validate patient category
                if patient_category not in patient_categories:
                    errors.append(f"Row {row_num}: Invalid patient category '{patient_category}'. Valid options: {list(patient_categories.keys())}")
                    continue
                
                # Validate service category
                if service_category not in service_categories:
                    errors.append(f"Row {row_num}: Invalid service category '{service_category}'. Valid options: {list(service_categories.keys())}")
                    continue
                
                # Validate discount type
                if discount_type not in ['percentage', 'fixed']:
                    errors.append(f"Row {row_num}: Discount type must be 'percentage' or 'fixed'")
                    continue
                
                # Validate discount value
                try:
                    discount_value = float(discount_value)
                    if discount_value < 0:
                        errors.append(f"Row {row_num}: Discount value cannot be negative")
                        continue
                except (ValueError, TypeError):
                    errors.append(f"Row {row_num}: Invalid discount value")
                    continue
                
                # Check if discount already exists
                existing_discount = Discount.query.filter_by(
                    patient_category_id=patient_categories[patient_category],
                    service_category_id=service_categories[service_category]
                ).first()
                
                if existing_discount:
                    # Update existing discount
                    existing_discount.discount_type = discount_type
                    existing_discount.discount_value = discount_value
                else:
                    # Create new discount
                    discount = Discount(
                        patient_category_id=patient_categories[patient_category],
                        service_category_id=service_categories[service_category],
                        discount_type=discount_type,
                        discount_value=discount_value
                    )
                    db.session.add(discount)
                
                success_count += 1
                
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        if success_count > 0:
            db.session.commit()
        
        return jsonify({
            'success_count': success_count, 
            'errors': errors,
            'message': f'Successfully processed {success_count} discounts'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error processing file: {str(e)}'}), 400

@main.route('/api/bulk-upload/discounts/template', methods=['GET'])
@login_required
def get_discounts_template():
    # Get actual patient and service categories from database
    patient_categories = [cat.name for cat in PatientCategory.query.all()]
    service_categories = [cat.name for cat in ServiceCategory.query.all()]
    
    # Create template with actual category names
    template = "patient_category,service_category,discount_type,discount_value\n"
    
    # Add examples using actual categories if available
    if patient_categories and service_categories:
        template += f"{patient_categories[0]},{service_categories[0]},percentage,10\n"
        if len(patient_categories) > 1 and len(service_categories) > 1:
            template += f"{patient_categories[1]},{service_categories[1]},fixed,50\n"
    else:
        # Fallback examples
        template += "charity,laboratory,percentage,10\n"
        template += "general,nursing,fixed,50\n"
    
    return jsonify({'template': template})

@main.route('/api/generate-estimate', methods=['POST'])
@login_required
def generate_estimate():
    """Generate detailed estimate with invoice format"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['patient_name', 'patient_category', 'length_of_stay', 'selected_services']
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
        
        patient_name = data['patient_name']
        patient_uhid = data.get('patient_uhid', 'Not provided')
        patient_category = data['patient_category']
        length_of_stay = int(data['length_of_stay'])
        selected_services = data['selected_services']  # List of service IDs
        
        if length_of_stay < 1:
            return jsonify({'error': 'Length of stay must be at least 1 day'}), 400
        
        # Get patient category details
        patient_cat = PatientCategory.query.filter_by(name=patient_category).first()
        if not patient_cat:
            return jsonify({'error': 'Invalid patient category'}), 400
        
        # Get selected services
        services = Service.query.filter(Service.id.in_(selected_services)).all()
        if not services:
            return jsonify({'error': 'No valid services selected'}), 400
        
        # Calculate estimate
        estimate_lines = []
        subtotal = 0
        total_discount = 0
        
        for service in services:
            # Get applicable discount for this service category and patient category
            discount = Discount.query.filter_by(
                patient_category_id=patient_cat.id,
                service_category_id=service.category_id
            ).first()
            
            # Calculate base cost
            if service.is_daily_charge:
                quantity = length_of_stay * service.visits_per_day
                unit_description = f"{service.visits_per_day} visits/day × {length_of_stay} days"
            else:
                quantity = 1
                unit_description = "One-time charge"
            
            line_total = float(service.mrp) * quantity
            
            # Apply discount if applicable
            discount_amount = 0
            discount_percentage = 0
            if discount:
                if discount.discount_type == 'percentage':
                    discount_percentage = float(discount.discount_value)
                    discount_amount = line_total * (discount_percentage / 100)
                else:  # flat discount
                    discount_amount = float(discount.discount_value) * quantity
                    discount_percentage = (discount_amount / line_total * 100) if line_total > 0 else 0
            
            final_amount = line_total - discount_amount
            
            estimate_lines.append({
                'service_name': service.name,
                'category': service.category.display_name,
                'unit_price': float(service.mrp),
                'quantity': quantity,
                'unit_description': unit_description,
                'line_total': line_total,
                'discount_percentage': round(discount_percentage, 2),
                'discount_amount': round(discount_amount, 2),
                'final_amount': round(final_amount, 2)
            })
            
            subtotal += line_total
            total_discount += discount_amount
        
        final_total = subtotal - total_discount
        
        # Prepare estimate response
        estimate = {
            'patient_details': {
                'name': patient_name,
                'uhid': patient_uhid,
                'category': patient_cat.display_name,
                'length_of_stay': length_of_stay
            },
            'estimate_lines': estimate_lines,
            'summary': {
                'subtotal': round(subtotal, 2),
                'total_discount': round(total_discount, 2),
                'final_total': round(final_total, 2),
                'discount_percentage': round((total_discount / subtotal * 100) if subtotal > 0 else 0, 2)
            },
            'generated_at': (datetime.utcnow() + timedelta(hours=5, minutes=30)).strftime('%Y-%m-%d %H:%M:%S'),
            'generated_by': current_user.role.capitalize()
        }
        
        return jsonify(estimate)
        
    except Exception as e:
        return jsonify({'error': f'Error generating estimate: {str(e)}'}), 500

@main.route('/api/save-estimate', methods=['POST'])
@login_required
def save_estimate():
    """Save estimate to database"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        required_fields = ['patient_name', 'patient_category', 'length_of_stay', 'estimate_data']
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
        
        estimate_data = data['estimate_data']
        
        # Generate estimate number
        last_estimate = SavedEstimate.query.order_by(SavedEstimate.id.desc()).first()
        if last_estimate:
            last_number = int(last_estimate.estimate_number[3:])  # Remove 'EST' prefix
            new_number = f"EST{last_number + 1:03d}"
        else:
            new_number = "EST001"
        
        # Create saved estimate record
        saved_estimate = SavedEstimate(
            estimate_number=new_number,
            patient_name=data['patient_name'],
            patient_uhid=data.get('patient_uhid', ''),
            patient_category=data['patient_category'],
            length_of_stay=int(data['length_of_stay']),
            subtotal=float(estimate_data['summary']['subtotal']),
            total_discount=float(estimate_data['summary']['total_discount']),
            final_total=float(estimate_data['summary']['final_total']),
            generated_by_role=current_user.role,
            generated_by_user_id=current_user.id,
            estimate_data=json.dumps(estimate_data)
        )
        
        db.session.add(saved_estimate)
        db.session.flush()  # Get the ID for the estimate
        
        # Save individual services
        for line in estimate_data['estimate_lines']:
            service_record = SavedEstimateService(
                saved_estimate_id=saved_estimate.id,
                service_id=line.get('service_id', 0),  # May not be available in frontend
                service_name=line['service_name'],
                quantity=line['quantity'],
                unit_price=float(line['unit_price']),
                line_total=float(line['line_total']),
                discount_amount=float(line['discount_amount']),
                final_amount=float(line['final_amount'])
            )
            db.session.add(service_record)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Estimate saved successfully',
            'estimate_number': new_number,
            'estimate_id': saved_estimate.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error saving estimate: {str(e)}'}), 500

@main.route('/api/saved-estimates', methods=['GET'])
@login_required
def get_saved_estimates():
    """Get list of saved estimates"""
    try:
        print(f"\n=== SAVED ESTIMATES API CALLED ===")
        print(f"Current user: {current_user.username} (ID: {current_user.id})")
        print(f"User role: {current_user.role}")
        print(f"Is admin: {current_user.is_admin}")
        
        # Check if admin wants to view all estimates
        view_all = request.args.get('view_all', 'false').lower() == 'true'
        print(f"View all parameter: {view_all}")
        
        # Check total estimates in database
        total_estimates = SavedEstimate.query.count()
        print(f"Total estimates in database: {total_estimates}")
        
        # Admin can choose to see all estimates or just their own
        # Managers and Users only see their own estimates  
        if current_user.is_admin and view_all:
            print("Admin viewing ALL estimates")
            estimates = SavedEstimate.query.order_by(SavedEstimate.created_at.desc()).all()
        else:
            # Default behavior: show only current user's estimates
            print(f"Viewing estimates for user ID: {current_user.id}")
            estimates = SavedEstimate.query.filter_by(generated_by_user_id=current_user.id).order_by(SavedEstimate.created_at.desc()).all()
        
        print(f"Found {len(estimates)} estimates for this query")
        
        # Debug: Print details of each estimate
        for est in estimates:
            print(f"  Estimate {est.id}: {est.estimate_number} by user {est.generated_by_user_id}")
        
        result = [{
            'id': est.id,
            'estimate_number': est.estimate_number,
            'patient_name': est.patient_name,
            'patient_uhid': est.patient_uhid,
            'patient_category': est.patient_category,
            'total_amount': float(est.final_total),  # Frontend expects 'total_amount'
            'generated_by_role': est.generated_by_role,
            'generated_by': est.generated_by_user.username,  # Frontend expects 'generated_by'
            'created_at': est.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for est in estimates]
        
        print(f"Returning {len(result)} estimates")
        print("=== END SAVED ESTIMATES API ===\n")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"ERROR in saved estimates API: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error retrieving estimates: {str(e)}'}), 500

@main.route('/api/saved-estimates/<int:estimate_id>', methods=['GET'])
@login_required
def get_saved_estimate(estimate_id):
    """Get specific saved estimate"""
    print(f"\n=== GET SAVED ESTIMATE {estimate_id} ===")
    print(f"Current user: {current_user.username} (ID: {current_user.id})")
    print(f"User role: {current_user.role}")
    print(f"Is admin: {current_user.is_admin}")
    print(f"Is manager: {current_user.is_manager}")
    
    try:
        print(f"Querying for estimate ID: {estimate_id}")
        estimate = SavedEstimate.query.get_or_404(estimate_id)
        print(f"Found estimate: {estimate.estimate_number}")
        print(f"Estimate generated by user ID: {estimate.generated_by_user_id}")
        
        # Check permissions
        has_permission = (current_user.is_admin or 
                         current_user.is_manager or 
                         estimate.generated_by_user_id == current_user.id)
        print(f"Permission check: {has_permission}")
        
        if not has_permission:
            print("ACCESS DENIED")
            return jsonify({'error': 'Access denied'}), 403
        
        print("ACCESS GRANTED - Building response...")
        response_data = {
            'id': estimate.id,
            'estimate_number': estimate.estimate_number,
            'patient_name': estimate.patient_name,
            'patient_uhid': estimate.patient_uhid,
            'patient_category': estimate.patient_category,
            'length_of_stay': estimate.length_of_stay,
            'total_amount': float(estimate.final_total),  # Fixed: use final_total instead of total_amount
            'created_at': estimate.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'estimate_data': estimate.estimate_data
        }
        print(f"Response data prepared, estimate_data length: {len(estimate.estimate_data) if estimate.estimate_data else 0}")
        print("=== END GET SAVED ESTIMATE ===\n")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"ERROR in get_saved_estimate: {str(e)}")
        print(f"Exception type: {type(e)}")
        import traceback
        print(f"Full traceback:\n{traceback.format_exc()}")
        print("=== END GET SAVED ESTIMATE (ERROR) ===\n")
        return jsonify({'error': f'Error retrieving estimate: {str(e)}'}), 500

# Debug endpoint to check database
@main.route('/api/debug/estimates', methods=['GET'])
@login_required
def debug_estimates():
    """Debug endpoint to check estimates in database"""
    try:
        total_estimates = SavedEstimate.query.count()
        all_estimates = SavedEstimate.query.all()
        
        return jsonify({
            'total_estimates': total_estimates,
            'estimates': [{
                'id': est.id,
                'estimate_number': est.estimate_number,
                'patient_name': est.patient_name,
                'generated_by_user_id': est.generated_by_user_id,
                'generated_by_username': est.generated_by_user.username if est.generated_by_user else 'Unknown'
            } for est in all_estimates]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500