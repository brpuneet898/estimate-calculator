from flask import Flask
from flask_login import LoginManager
from werkzeug.security import generate_password_hash
from models import db, User, ServiceCategory, PatientCategory
import os

def create_app():
    app = Flask(__name__)
    app.debug = True
    app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET', 'dev-secret-change-me')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital_estimate.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    
    # Login manager configuration
    login_manager = LoginManager()
    login_manager.login_view = 'main.login_page'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.init_app(app)
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # Register blueprints
    from routes import main
    app.register_blueprint(main)
    
    # Create tables and default data
    with app.app_context():
        db.create_all()
        create_default_data()
    
    return app

def create_default_data():
    """Create default categories and admin user"""
    
    print("\n=== Creating Default Data ===")
    
    # Service categories
    service_cats = [
        ('nursing', 'Nursing'), ('room', 'Room Charges'), ('doctor', 'Doctor Visit'),
        ('laboratory', 'Laboratory'), ('radiology', 'Radiology'), ('pharmacy', 'Pharmacy'),
        ('equipment', 'Equipment'), ('procedures', 'Procedures'), ('surgery', 'Surgery')
    ]
    print("\nService Categories to create:", service_cats)
    
    # Patient categories  
    patient_cats = [
        ('charity', 'Charity'), ('general_nc_a', 'General NC A'), ('general_nc_b', 'General NC B'),
        ('general', 'General'), ('deluxe', 'Deluxe'), ('super_deluxe', 'Super Deluxe')
    ]
    
    # Create categories if they don't exist
    for name, display_name in service_cats:
        if not ServiceCategory.query.filter_by(name=name).first():
            db.session.add(ServiceCategory(name=name, display_name=display_name))
    
    for name, display_name in patient_cats:
        if not PatientCategory.query.filter_by(name=name).first():
            db.session.add(PatientCategory(name=name, display_name=display_name))
    
    # Create admin user
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', role='admin', approved=True, rejected=False)
        admin.set_password('admin')
        db.session.add(admin)
    
    # Create test user for user dashboard
    if not User.query.filter_by(username='testuser').first():
        user = User(username='testuser', role='user', approved=True, rejected=False)
        user.set_password('testuser')
        db.session.add(user)
    
    db.session.commit()

# Create app instance
app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
