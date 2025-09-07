from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'admin', 'manager', or 'user'
    approved = db.Column(db.Boolean, default=False, nullable=False)  # Admin approval status
    rejected = db.Column(db.Boolean, default=False, nullable=False)  # Admin rejection status
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def is_admin(self):
        return self.role == 'admin'
        
    @property
    def is_manager(self):
        return self.role == 'manager'

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)


class PendingUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)  # store hashed password
    role = db.Column(db.String(20), nullable=False, default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

class ServiceCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    services = db.relationship('Service', backref='category', lazy=True)
    discounts = db.relationship('Discount', backref='service_category', lazy=True)

class Service(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('service_category.id'), nullable=False)
    cost_price = db.Column(db.Numeric(10, 2), nullable=False)
    mrp = db.Column(db.Numeric(10, 2), nullable=False)
    is_daily_charge = db.Column(db.Boolean, default=False)
    visits_per_day = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class PatientCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    discounts = db.relationship('Discount', backref='patient_category', lazy=True)

class Discount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_category_id = db.Column(db.Integer, db.ForeignKey('patient_category.id'), nullable=False)
    service_category_id = db.Column(db.Integer, db.ForeignKey('service_category.id'), nullable=False)
    discount_type = db.Column(db.String(20), nullable=False)  # 'percentage' or 'flat'
    discount_value = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('patient_category_id', 'service_category_id'),)

class SavedEstimate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    estimate_number = db.Column(db.String(20), unique=True, nullable=False)  # EST001, EST002, etc.
    patient_name = db.Column(db.String(200), nullable=False)
    patient_uhid = db.Column(db.String(50), nullable=True)
    patient_category = db.Column(db.String(50), nullable=False)
    length_of_stay = db.Column(db.Integer, nullable=False)
    
    # Financial summary
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    total_discount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    final_total = db.Column(db.Numeric(10, 2), nullable=False)
    
    # Metadata
    generated_by_role = db.Column(db.String(20), nullable=False)
    generated_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # JSON field to store complete estimate data
    estimate_data = db.Column(db.Text, nullable=False)  # JSON string of full estimate
    
    # Relationships
    generated_by_user = db.relationship('User', backref='saved_estimates', lazy=True)

class SavedEstimateService(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    saved_estimate_id = db.Column(db.Integer, db.ForeignKey('saved_estimate.id'), nullable=False)
    service_id = db.Column(db.Integer, db.ForeignKey('service.id'), nullable=False)
    service_name = db.Column(db.String(200), nullable=False)  # Store name at time of estimate
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    line_total = db.Column(db.Numeric(10, 2), nullable=False)
    discount_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    final_amount = db.Column(db.Numeric(10, 2), nullable=False)
    
    # Relationships
    saved_estimate = db.relationship('SavedEstimate', backref='estimate_services', lazy=True)
    service = db.relationship('Service', backref='saved_estimate_services', lazy=True)