// Hospital Estimate Builder - Main Application JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // Initialize
    checkAuthStatus();
    loadServiceCategoryTabs();
    initializeMastersTabs();
    loadCategories();

    // Track selected services
    let selectedServices = new Set();

    // Patient form handling
    const patientForm = document.getElementById('patient-form');
    const patientInputs = patientForm.querySelectorAll('input, select');

    patientInputs.forEach(input => {
        input.addEventListener('change', updatePatientSummary);
        input.addEventListener('input', updatePatientSummary);
    });

    // Generate estimate button
    const generateEstimateBtn = document.getElementById('generate-estimate-btn');
    if (generateEstimateBtn) {
        generateEstimateBtn.addEventListener('click', generateEstimate);
    }

    // Load and initialize service category tabs
    async function loadServiceCategoryTabs() {
        try {
            console.log('Fetching service categories from server...');
            const response = await fetch('/api/service-categories');
            const categories = await response.json();
            console.log('All categories from server:', categories);

            const tabsContainer = document.getElementById('service-category-tabs');
            if (!tabsContainer) {
                console.error('Could not find service-category-tabs element!');
                return;
            }

            // Create tab buttons for all categories
            categories.forEach((category, index) => {
                const btn = document.createElement('button');
                btn.className = `service-tab-btn ${index === 0 ? 'active' : ''}`;
                btn.setAttribute('data-category', category.name);
                btn.textContent = category.display_name;

                btn.addEventListener('click', () => {
                    console.log('Clicked category:', category.name);
                    // Update active tab
                    document.querySelectorAll('.service-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Load services for this category
                    loadServicesByCategory(category.name);
                });

                tabsContainer.appendChild(btn);
                console.log('Added tab button for category:', category.name);
            });

            // Load services for first category
            if (categories.length > 0) {
                loadServicesByCategory(categories[0].name);
            }
        } catch (error) {
            console.error('Error loading service categories:', error);
        }
    }

    // Masters modal tabs
    function initializeMastersTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Update active tab button
                tabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });

                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');

                // Show corresponding tab content and update aria-hidden
                tabContents.forEach(content => {
                    content.style.display = 'none';
                    content.setAttribute('aria-hidden', 'true');
                });

                const panel = document.getElementById(`${tabName}-tab`);
                if (panel) {
                    panel.style.display = 'block';
                    panel.setAttribute('aria-hidden', 'false');
                    // move focus to first interactive element inside panel for keyboard users
                    const focusable = panel.querySelector('button, a, input, select, textarea');
                    if (focusable) focusable.focus();
                }

                // Load data for the active tab
                if (tabName === 'services') {
                    loadMastersServices();
                } else if (tabName === 'discounts') {
                    loadDiscounts();
                } else if (tabName === 'user-approvals') {
                    if (typeof loadPendingUsers === 'function') {
                        loadPendingUsers();
                    }
                }
            });

            // Extra: if this is the approvals button, ensure refresh on click
            if (btn.id === 'user-approvals-btn') {
                btn.addEventListener('click', () => {
                    if (typeof loadPendingUsers === 'function') loadPendingUsers();
                });
            }

            // support left/right arrow navigation between tabs
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const buttons = Array.from(tabBtns);
                    const idx = buttons.indexOf(btn);
                    const next = e.key === 'ArrowRight' ? buttons[(idx + 1) % buttons.length] : buttons[(idx - 1 + buttons.length) % buttons.length];
                    next.focus();
                    next.click();
                }
            });
        });

        // Ensure initial state: only the active tab's panel visible and aria attributes correct
        const activeBtn = document.querySelector('.tab-btn.active') || tabBtns[0];
        if (activeBtn) activeBtn.click();
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

                // Check if user is approved and is admin
                if (!userData.approved) {
                    window.location.href = '/dashboard'; // Will redirect to pending page
                } else if (!userData.is_admin) {
                    window.location.href = '/dashboard'; // Redirect to their proper dashboard
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
        const fields = [
            ['patient-name', 'summary-name', 'Not specified'],
            ['patient-uhid', 'summary-uhid', 'Not specified'],
            ['patient-category', 'summary-category', 'Not selected'],
            ['patient-stay', 'summary-stay', '1']
        ];

        fields.forEach(([inputId, summaryId, defaultVal]) => {
            document.getElementById(summaryId).textContent =
                document.getElementById(inputId).value || defaultVal;
        });
    }

    // Load services by category for main interface
    async function loadServicesByCategory(category) {
        try {
            const response = await fetch('/api/services');
            const allServices = await response.json();
            const categoryServices = allServices.filter(service => service.category_name === category);
            const servicesList = document.getElementById('services-list');

            if (categoryServices.length === 0) {
                servicesList.innerHTML = '<div class="text-muted text-center">No services available in this category</div>';
                return;
            }

            servicesList.innerHTML = categoryServices.map(service => `
                <div class="service-item">
                    <div class="service-info">
                        <div class="service-name">${service.name}</div>
                        <div class="service-price">₹${parseFloat(service.mrp).toFixed(2)}</div>
                    </div>
                    <button class="btn ${selectedServices.has(service.id) ? 'btn-primary' : 'btn-outline'} service-select-btn" 
                            onclick="toggleService(${service.id})">
                        ${selectedServices.has(service.id) ? 'Selected' : 'Select'}
                    </button>
                </div>
            `).join('') + `<div class="text-muted text-center" style="margin-top: 1rem">Showing ${categoryServices.length} services | ${selectedServices.size} selected</div>`;

        } catch (error) {
            console.error('Error loading services:', error);
        }
    }

    // Toggle service selection
    window.toggleService = function(serviceId) {
        if (selectedServices.has(serviceId)) {
            selectedServices.delete(serviceId);
        } else {
            selectedServices.add(serviceId);
        }
        
        // Refresh the current category to update button states
        const activeTab = document.querySelector('.service-tab-btn.active');
        if (activeTab) {
            const category = activeTab.getAttribute('data-category');
            loadServicesByCategory(category);
        }
        
        showMessage(`Service ${selectedServices.has(serviceId) ? 'selected' : 'deselected'}!`, 'success');
    };

    // Generate estimate function
    async function generateEstimate() {
        try {
            // Validate patient information
            const patientName = document.getElementById('patient-name').value.trim();
            const patientUhid = document.getElementById('patient-uhid').value.trim();
            const patientCategory = document.getElementById('patient-category').value;
            const lengthOfStay = parseInt(document.getElementById('patient-stay').value);

            if (!patientName) {
                showMessage('Please enter patient name', 'error');
                return;
            }
            
            if (!patientCategory) {
                showMessage('Please select patient category', 'error');
                return;
            }
            
            if (!lengthOfStay || lengthOfStay < 1) {
                showMessage('Please enter valid length of stay', 'error');
                return;
            }
            
            if (selectedServices.size === 0) {
                showMessage('Please select at least one service', 'error');
                return;
            }

            // Show loading state
            const estimateBtn = document.getElementById('generate-estimate-btn');
            const originalText = estimateBtn.textContent;
            estimateBtn.textContent = 'Generating...';
            estimateBtn.disabled = true;

            // Prepare request data
            const requestData = {
                patient_name: patientName,
                patient_uhid: patientUhid,
                patient_category: patientCategory,
                length_of_stay: lengthOfStay,
                selected_services: Array.from(selectedServices)
            };

            // Call estimate API
            const response = await fetch('/api/generate-estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (response.ok) {
                displayEstimate(result);
                showMessage('Estimate generated successfully!', 'success');
            } else {
                showMessage(result.error || 'Error generating estimate', 'error');
            }

        } catch (error) {
            console.error('Error generating estimate:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            const estimateBtn = document.getElementById('generate-estimate-btn');
            estimateBtn.textContent = 'Generate Estimate';
            estimateBtn.disabled = false;
        }
    }

    // Display estimate in invoice format
    function displayEstimate(estimate) {
        const estimateDetails = document.getElementById('estimate-details');
        const estimatePlaceholder = document.getElementById('estimate-placeholder');
        
        if (estimateDetails && estimatePlaceholder) {
            estimatePlaceholder.style.display = 'none';
            estimateDetails.style.display = 'block';
            
            estimateDetails.innerHTML = `
                <div class="invoice-header" style="border-bottom: 2px solid var(--border); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--primary);">MEDICAL ESTIMATE</h4>
                    <div style="font-size: 0.875rem; color: var(--muted-foreground);">
                        <div><strong>Generated:</strong> ${estimate.generated_at}</div>
                        <div><strong>Generated by:</strong> ${estimate.generated_by}</div>
                    </div>
                </div>
                
                <div class="patient-info" style="background: var(--accent); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                    <h5 style="margin: 0 0 0.5rem 0;">Patient Information</h5>
                    <div style="font-size: 0.875rem;">
                        <div><strong>Name:</strong> ${estimate.patient_details.name}</div>
                        <div><strong>UHID:</strong> ${estimate.patient_details.uhid}</div>
                        <div><strong>Category:</strong> ${estimate.patient_details.category}</div>
                        <div><strong>Length of Stay:</strong> ${estimate.patient_details.length_of_stay} day(s)</div>
                    </div>
                </div>
                
                <div class="services-breakdown" style="margin-bottom: 1rem;">
                    <h5 style="margin: 0 0 0.75rem 0;">Services & Charges</h5>
                    <div class="services-table">
                        ${estimate.estimate_lines.map(line => `
                            <div class="estimate-line-item" style="border-bottom: 1px solid var(--border); padding: 0.75rem 0;">
                                <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.25rem;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600;">${line.service_name}</div>
                                        <div style="font-size: 0.75rem; color: var(--muted-foreground);">${line.category} • ${line.unit_description}</div>
                                    </div>
                                    <div style="text-align: right; min-width: 100px;">
                                        <div style="font-weight: 600;">₹${line.final_amount.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--muted-foreground); display: flex; justify-content: space-between;">
                                    <span>₹${line.unit_price.toFixed(2)} × ${line.quantity} = ₹${line.line_total.toFixed(2)}</span>
                                    ${line.discount_amount > 0 ? `<span style="color: var(--primary);">-₹${line.discount_amount.toFixed(2)} (${line.discount_percentage}% off)</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="estimate-summary" style="background: var(--accent); padding: 1rem; border-radius: 6px;">
                    <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Subtotal:</span>
                        <span>₹${estimate.summary.subtotal.toFixed(2)}</span>
                    </div>
                    ${estimate.summary.total_discount > 0 ? `
                    <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--primary);">
                        <span>Total Discount (${estimate.summary.discount_percentage}%):</span>
                        <span>-₹${estimate.summary.total_discount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="summary-line" style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 600; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                        <span>Total Amount:</span>
                        <span style="color: var(--primary);">₹${estimate.summary.final_total.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; font-size: 0.875rem;">
                    <strong>Note:</strong> This is an estimated cost. Actual charges may vary based on treatment requirements and additional services.
                </div>
            `;
        }
    }

    // Global function to select a service (for backward compatibility)
    window.selectService = function (serviceId) {
        toggleService(serviceId);
    };

    // Print estimate function
    window.printEstimate = function() {
        const estimateDetails = document.getElementById('estimate-details');
        
        if (!estimateDetails || estimateDetails.style.display === 'none') {
            showMessage('Please generate an estimate first', 'error');
            return;
        }
        
        // Create a new window for print preview
        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        printWindow.document.write(`
            <html>
            <head>
                <title>Medical Estimate - Print Preview</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px;
                        background: #f5f5f5;
                    }
                    .print-container {
                        background: white;
                        padding: 30px;
                        margin: 20px auto;
                        max-width: 800px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                        border-radius: 8px;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 20px;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 5px;
                    }
                    .invoice-header { 
                        border-bottom: 2px solid #0066cc; 
                        padding-bottom: 15px; 
                        margin-bottom: 20px; 
                    }
                    .patient-info { 
                        background: #f8f9fa; 
                        padding: 15px; 
                        margin-bottom: 15px; 
                        border-radius: 5px;
                    }
                    .estimate-summary { 
                        background: #f8f9fa; 
                        padding: 15px; 
                        border-radius: 5px;
                    }
                    .estimate-line-item { 
                        border-bottom: 1px solid #ddd; 
                        padding: 12px 0; 
                    }
                    .summary-line { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 8px; 
                    }
                    .print-buttons {
                        text-align: center;
                        margin: 20px 0;
                        padding: 15px;
                        background: #e9ecef;
                        border-radius: 5px;
                    }
                    .btn {
                        padding: 10px 20px;
                        margin: 0 10px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .btn-primary {
                        background: #0066cc;
                        color: white;
                    }
                    .btn-secondary {
                        background: #6c757d;
                        color: white;
                    }
                    @media print { 
                        body { 
                            margin: 0; 
                            background: white;
                        }
                        .print-container {
                            box-shadow: none;
                            margin: 0;
                            padding: 20px;
                        }
                        .print-header, .print-buttons { 
                            display: none; 
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="print-header">
                        <h2 style="margin: 0; color: #0066cc;">Medical Estimate - Print Preview</h2>
                        <p style="margin: 5px 0; color: #666;">Review the estimate below and click Print to generate PDF or print</p>
                    </div>
                    
                    <div class="print-buttons">
                        <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
                        <button class="btn btn-secondary" onclick="window.close()">❌ Close</button>
                    </div>
                    
                    <div class="estimate-content">
                        ${estimateDetails.innerHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
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
    window.openMastersModal = function () {
        document.getElementById('masters-modal').style.display = 'flex';
        loadMastersServices();
    };

    window.closeMastersModal = function () {
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
        // The service form lives inside the Services tab. Show the Services tab and
        // populate the form for editing when a service object is provided.
        const form = document.getElementById('service-form');
        const title = document.getElementById('service-form-title');

        if (service) {
            title.textContent = 'Edit Service';
            document.getElementById('service-id').value = service.id;
            document.getElementById('service-name').value = service.name;
            document.getElementById('service-category').value = service.category_id;
            document.getElementById('service-cost').value = parseFloat(service.cost_price);
            document.getElementById('service-mrp').value = parseFloat(service.mrp);
            document.getElementById('service-daily').value = service.is_daily_charge ? 'true' : 'false';
            document.getElementById('service-visits').value = service.visits_per_day || 1;
            document.getElementById('service-submit-btn').textContent = 'Save Changes';
        } else {
            title.textContent = 'Add New Service';
            form.reset();
            document.getElementById('service-id').value = '';
            document.getElementById('service-visits').value = '1';
            document.getElementById('service-submit-btn').textContent = 'Add Service';
        }

        // Switch to Services tab so the form is visible
        const servicesTabBtn = document.querySelector('.tab-btn[data-tab="services"]');
        if (servicesTabBtn) servicesTabBtn.click();

        // Focus the name input for faster editing
        const nameInput = document.getElementById('service-name');
        if (nameInput) nameInput.focus();
    }

    async function handleServiceSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('service-id').value;
        const formData = {
            name: document.getElementById('service-name').value,
            category_id: parseInt(document.getElementById('service-category').value),
            cost_price: parseFloat(document.getElementById('service-cost').value),
            mrp: parseFloat(document.getElementById('service-mrp').value),
            is_daily_charge: document.getElementById('service-daily').value === 'true',
            visits_per_day: parseInt(document.getElementById('service-visits').value) || 1
        };

        try {
            const url = id ? `/api/services/${id}` : '/api/services';
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                // Reset form to add mode
                document.getElementById('service-form').reset();
                document.getElementById('service-visits').value = '1';
                document.getElementById('service-id').value = '';
                document.getElementById('service-form-title').textContent = 'Add New Service';
                document.getElementById('service-submit-btn').textContent = 'Add Service';

                loadMastersServices();
                const activeCatBtn = document.querySelector('.service-tab-btn.active');
                if (activeCatBtn) loadServicesByCategory(activeCatBtn.dataset.category);
                showMessage(id ? 'Service updated successfully!' : 'Service added successfully!', 'success');
            } else {
                showMessage(result.error || 'Error saving service', 'error');
            }
        } catch (error) {
            console.error('Error saving service:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    }

    // Global functions for service actions
    window.editService = async function (serviceId) {
        try {
            const response = await fetch('/api/services');
            const services = await response.json();
            const service = services.find(s => s.id === serviceId);
            if (service) {
                // open and populate the inline form for editing
                openServiceModal(service);
            }
        } catch (error) {
            console.error('Error loading service:', error);
        }
    };

    window.deleteService = async function (serviceId) {
        if (!confirm('Are you sure you want to delete this service?')) return;

        try {
            const response = await fetch(`/api/services/${serviceId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Refresh masters table and main services list
                loadMastersServices();
                const activeCatBtn = document.querySelector('.service-tab-btn.active');
                if (activeCatBtn) loadServicesByCategory(activeCatBtn.dataset.category);
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
                        <button class="btn btn-outline btn-sm" onclick="editDiscount(${discount.id})">Edit</button>
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
        // If discount-id is present we are editing — preserve form values.
        const idField = document.getElementById('discount-id');
        if (!idField || !idField.value) {
            form.reset();
            if (idField) idField.value = '';
        }
        modal.style.display = 'flex';
    }

    window.closeDiscountModal = function () {
        document.getElementById('discount-modal').style.display = 'none';
    };

    async function handleDiscountSubmit(e) {
        e.preventDefault();
        const id = (document.getElementById('discount-id') || {}).value;
        const payload = {
            patient_category_id: parseInt(document.getElementById('discount-patient-category').value),
            service_category_id: parseInt(document.getElementById('discount-service-category').value),
            discount_type: document.getElementById('discount-type').value,
            discount_value: parseFloat(document.getElementById('discount-value').value)
        };

        try {
            let response;
            if (id) {
                // Edit existing discount via PUT to explicit resource (same approach as services)
                response = await fetch(`/api/discounts/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create/Upsert
                response = await fetch('/api/discounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();

            if (response.ok) {
                document.getElementById('discount-modal').style.display = 'none';
                // clear hidden id after successful save
                const idField = document.getElementById('discount-id');
                if (idField) idField.value = '';
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

    window.deleteDiscount = async function (discountId) {
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

    window.editDiscount = async function (discountId) {
        try {
            const response = await fetch('/api/discounts');
            const discounts = await response.json();
            const discount = discounts.find(d => d.id === discountId);
            if (discount) {
                document.getElementById('discount-patient-category').value = discount.patient_category_id;
                document.getElementById('discount-service-category').value = discount.service_category_id;
                document.getElementById('discount-type').value = discount.discount_type;
                document.getElementById('discount-value').value = parseFloat(discount.discount_value);
                // set hidden id to signal edit
                const idField = document.getElementById('discount-id');
                if (idField) idField.value = discount.id;
                openDiscountModal();
            }
        } catch (error) {
            console.error('Error loading discount for edit:', error);
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

    // Global logout function
    window.logout = async function () {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                showMessage('Logged out successfully!', 'success');
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1000);
            } else {
                showMessage('Error logging out', 'error');
            }
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Network error during logout', 'error');
        }
    };
});