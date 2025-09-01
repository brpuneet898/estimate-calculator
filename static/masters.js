// Hospital Estimate Builder - Main Application JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    checkAuthStatus();
    initializeServiceTabs();
    initializeMastersTabs();
    loadCategories();
    loadServicesByCategory('laboratory');
    
    // Patient form handling
    const patientForm = document.getElementById('patient-form');
    const patientInputs = patientForm.querySelectorAll('input, select');
    
    patientInputs.forEach(input => {
        input.addEventListener('change', updatePatientSummary);
        input.addEventListener('input', updatePatientSummary);
    });

    // Service category tabs
    function initializeServiceTabs() {
        const tabBtns = document.querySelectorAll('.service-tab-btn');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                
                // Update active tab
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update title and load services
                document.getElementById('service-category-title').textContent = 
                    btn.textContent + ' Services';
                loadServicesByCategory(category);
            });
        });
    }

    // Masters modal tabs
    function initializeMastersTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                
                // Update active tab button
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show corresponding tab content
                tabContents.forEach(content => {
                    content.style.display = 'none';
                });
                document.getElementById(`${tabName}-tab`).style.display = 'block';
                
                // Load data for the active tab
                if (tabName === 'services') {
                    loadMastersServices();
                } else if (tabName === 'discounts') {
                    loadDiscounts();
                }
            });
        });
    }

    // Form submissions
    const serviceForm = document.getElementById('service-form');
    serviceForm.addEventListener('submit', handleServiceSubmit);
    
    const discountForm = document.getElementById('discount-form');
    if (discountForm) {
        discountForm.addEventListener('submit', handleDiscountSubmit);
    }
    
    // Bulk upload
    const uploadBtn = document.getElementById('upload-csv-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    
    if (uploadBtn) uploadBtn.addEventListener('click', handleBulkUpload);
    if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', downloadTemplate);
    
    // Discount modal button
    const addDiscountBtn = document.getElementById('add-discount-btn');
    if (addDiscountBtn) {
        addDiscountBtn.addEventListener('click', () => {
            openDiscountModal();
        });
    }

    // Auth check
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/user-info');
            if (response.ok) {
                const userData = await response.json();
                document.getElementById('user-name').textContent = userData.username;
                
                // If not admin, redirect to login
                if (!userData.is_admin) {
                    window.location.href = '/login';
                }
            } else {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/login';
        }
    }

    // Patient summary update
    function updatePatientSummary() {
        const name = document.getElementById('patient-name').value || 'Not specified';
        const uhid = document.getElementById('patient-uhid').value || 'Not specified';
        const category = document.getElementById('patient-category').value || 'Not selected';
        const stay = document.getElementById('patient-stay').value || '1';
        
        document.getElementById('summary-name').textContent = name;
        document.getElementById('summary-uhid').textContent = uhid;
        document.getElementById('summary-category').textContent = category;
        document.getElementById('summary-stay').textContent = stay;
    }

    // Load services by category for main interface
    async function loadServicesByCategory(category) {
        try {
            const response = await fetch('/api/services');
            const allServices = await response.json();
            
            const categoryServices = allServices.filter(service => 
                service.category_name === category
            );
            
            const servicesList = document.getElementById('services-list');
            servicesList.innerHTML = '';
            
            if (categoryServices.length === 0) {
                servicesList.innerHTML = '<div class="text-muted text-center">No services available in this category</div>';
                return;
            }
            
            categoryServices.forEach(service => {
                const serviceItem = document.createElement('div');
                serviceItem.className = 'service-item';
                serviceItem.innerHTML = `
                    <div class="service-info">
                        <div class="service-name">${service.name}</div>
                        <div class="service-price">₹${parseFloat(service.mrp).toFixed(2)}</div>
                    </div>
                    <button class="btn btn-primary service-select-btn" onclick="selectService(${service.id})">
                        Select
                    </button>
                `;
                servicesList.appendChild(serviceItem);
            });
            
            // Add count info
            const countInfo = document.createElement('div');
            countInfo.className = 'text-muted text-center';
            countInfo.style.marginTop = '1rem';
            countInfo.textContent = `Showing ${categoryServices.length} services. Use search to find specific services.`;
            servicesList.appendChild(countInfo);
            
        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    // Global function to select a service
    window.selectService = function(serviceId) {
        // Add service selection logic here
        showMessage('Service selected!', 'success');
    };

    // Load categories for dropdowns
    async function loadCategories() {
        try {
            const [serviceCategories, patientCategories] = await Promise.all([
                fetch('/api/service-categories').then(r => r.json()),
                fetch('/api/patient-categories').then(r => r.json())
            ]);

            // Populate service category dropdowns
            const serviceCategorySelect = document.getElementById('service-category');
            const discountServiceCategorySelect = document.getElementById('discount-service-category');
            
            serviceCategorySelect.innerHTML = '<option value="">Select Category</option>';
            discountServiceCategorySelect.innerHTML = '<option value="">Select Service Category</option>';
            
            serviceCategories.forEach(cat => {
                serviceCategorySelect.innerHTML += `<option value="${cat.id}">${cat.display_name}</option>`;
                discountServiceCategorySelect.innerHTML += `<option value="${cat.id}">${cat.display_name}</option>`;
            });

            // Populate patient category dropdown
            const patientCategorySelect = document.getElementById('discount-patient-category');
            patientCategorySelect.innerHTML = '<option value="">Select Patient Category</option>';
            
            patientCategories.forEach(cat => {
                patientCategorySelect.innerHTML += `<option value="${cat.id}">${cat.display_name}</option>`;
            });

        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Masters Modal Functions
    window.openMastersModal = function() {
        document.getElementById('masters-modal').style.display = 'flex';
        loadMastersServices();
    };

    window.closeMastersModal = function() {
        document.getElementById('masters-modal').style.display = 'none';
    };

    // Services Management in Masters Modal
    async function loadMastersServices() {
        try {
            const response = await fetch('/api/services');
            const services = await response.json();
            
            const tbody = document.getElementById('services-tbody');
            tbody.innerHTML = '';
            
            services.forEach(service => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${service.name}</td>
                    <td>${service.category_display_name}</td>
                    <td>₹${parseFloat(service.cost_price).toFixed(2)}</td>
                    <td>₹${parseFloat(service.mrp).toFixed(2)}</td>
                    <td>
                        <span class="badge ${service.is_daily_charge ? 'badge-success' : 'badge-info'}">
                            ${service.is_daily_charge ? 'Yes' : 'No'}
                        </span>
                    </td>
                    <td>${service.visits_per_day || 1}</td>
                    <td>
                        <button class="btn btn-outline btn-sm" onclick="editService(${service.id})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    function openServiceModal(service = null) {
        const modal = document.getElementById('service-modal');
        const title = document.getElementById('service-modal-title');
        const form = document.getElementById('service-form');
        
        if (service) {
            title.textContent = 'Edit Service';
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-name').value = service.name;
            document.getElementById('service-category').value = service.category_id;
            document.getElementById('service-cost').value = service.cost_price;
            document.getElementById('service-mrp').value = service.mrp;
            document.getElementById('service-daily').checked = service.is_daily_charge;
        } else {
            title.textContent = 'Add Service';
            form.reset();
            document.getElementById('service-id').value = '';
        }
        
        modal.style.display = 'flex';
    }

    async function handleServiceSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('service-name').value,
            category_id: parseInt(document.getElementById('service-category').value),
            cost_price: parseFloat(document.getElementById('service-cost').value),
            mrp: parseFloat(document.getElementById('service-mrp').value),
            is_daily_charge: document.getElementById('service-daily').value === 'true',
            visits_per_day: parseInt(document.getElementById('service-visits').value) || 1
        };

        try {
            const response = await fetch('/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (response.ok) {
                // Reset form
                document.getElementById('service-form').reset();
                document.getElementById('service-visits').value = '1';
                
                loadMastersServices();
                loadServicesByCategory(document.querySelector('.service-tab-btn.active').dataset.category);
                showMessage('Service added successfully!', 'success');
            } else {
                showMessage(result.error || 'Error saving service', 'error');
            }
        } catch (error) {
            console.error('Error saving service:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // Global functions for service actions
    window.editService = async function(serviceId) {
        try {
            const response = await fetch('/api/services');
            const services = await response.json();
            const service = services.find(s => s.id === serviceId);
            if (service) {
                openServiceModal(service);
            }
        } catch (error) {
            console.error('Error loading service:', error);
        }
    };

    window.deleteService = async function(serviceId) {
        if (!confirm('Are you sure you want to delete this service?')) return;
        
        try {
            const response = await fetch(`/api/services/${serviceId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadServices();
                showMessage('Service deleted successfully!', 'success');
            } else {
                const result = await response.json();
                showMessage(result.error || 'Error deleting service', 'error');
            }
        } catch (error) {
            console.error('Error deleting service:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    };

    // Discounts Management
    async function loadDiscounts() {
        try {
            const response = await fetch('/api/discounts');
            const discounts = await response.json();
            
            const tbody = document.getElementById('discounts-tbody');
            tbody.innerHTML = '';
            
            discounts.forEach(discount => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${discount.patient_category_display}</td>
                    <td>${discount.service_category_display}</td>
                    <td>
                        <span class="badge ${discount.discount_type === 'percentage' ? 'badge-info' : 'badge-warning'}">
                            ${discount.discount_type === 'percentage' ? 'Percentage' : 'Flat Amount'}
                        </span>
                    </td>
                    <td>
                        ${discount.discount_type === 'percentage' ? 
                          `${discount.discount_value}%` : 
                          `₹${parseFloat(discount.discount_value).toFixed(2)}`}
                    </td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteDiscount(${discount.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading discounts:', error);
        }
    }

    function openDiscountModal() {
        const modal = document.getElementById('discount-modal');
        const form = document.getElementById('discount-form');
        form.reset();
        modal.style.display = 'flex';
    }

    window.closeDiscountModal = function() {
        document.getElementById('discount-modal').style.display = 'none';
    };

    async function handleDiscountSubmit(e) {
        e.preventDefault();
        
        const formData = {
            patient_category_id: parseInt(document.getElementById('discount-patient-category').value),
            service_category_id: parseInt(document.getElementById('discount-service-category').value),
            discount_type: document.getElementById('discount-type').value,
            discount_value: parseFloat(document.getElementById('discount-value').value)
        };

        try {
            const response = await fetch('/api/discounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (response.ok) {
                document.getElementById('discount-modal').style.display = 'none';
                loadDiscounts();
                showMessage('Discount saved successfully!', 'success');
            } else {
                showMessage(result.error || 'Error saving discount', 'error');
            }
        } catch (error) {
            console.error('Error saving discount:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    window.deleteDiscount = async function(discountId) {
        if (!confirm('Are you sure you want to delete this discount?')) return;
        
        try {
            const response = await fetch(`/api/discounts/${discountId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadDiscounts();
                showMessage('Discount deleted successfully!', 'success');
            } else {
                const result = await response.json();
                showMessage(result.error || 'Error deleting discount', 'error');
            }
        } catch (error) {
            console.error('Error deleting discount:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    };

    // Bulk Upload
    async function handleBulkUpload() {
        const csvContent = document.getElementById('csv-content').value.trim();
        
        if (!csvContent) {
            showMessage('Please enter CSV content', 'error');
            return;
        }

        try {
            const response = await fetch('/api/bulk-upload/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csv_content: csvContent })
            });

            const result = await response.json();
            
            if (response.ok) {
                const resultDiv = document.getElementById('upload-result');
                let html = `<div class="alert alert-success">
                    Successfully uploaded ${result.success_count} services!
                </div>`;
                
                if (result.errors && result.errors.length > 0) {
                    html += `<div class="alert alert-error">
                        <strong>Errors:</strong><br>
                        ${result.errors.join('<br>')}
                    </div>`;
                }
                
                resultDiv.innerHTML = html;
                loadServices(); // Refresh services list
                document.getElementById('csv-content').value = '';
            } else {
                showMessage(result.error || 'Error uploading services', 'error');
            }
        } catch (error) {
            console.error('Error uploading services:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    async function downloadTemplate() {
        try {
            const response = await fetch('/api/bulk-upload/services/template');
            const result = await response.json();
            
            if (response.ok) {
                // Create and download file
                const blob = new Blob([result.template], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'services_template.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                showMessage('Error downloading template', 'error');
            }
        } catch (error) {
            console.error('Error downloading template:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // Utility function to show messages
    function showMessage(message, type) {
        // Create a temporary message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `alert alert-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.zIndex = '9999';
        messageDiv.style.minWidth = '300px';
        
        document.body.appendChild(messageDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }
});