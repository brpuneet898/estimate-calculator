// Hospital Estimate Builder - Main Application JavaScript

// Utility function to show messages (global scope)
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '9999';
    messageDiv.style.minWidth = '300px';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Global function for opening service modal (available immediately)
window.openServiceModal = function(service = null) {
    console.log('openServiceModal called with:', service);
    
    const modal = document.getElementById('service-modal');
    const form = document.getElementById('service-modal-form');
    const title = document.getElementById('service-modal-title');
    
    if (!modal) {
        console.error('Service modal not found!');
        return;
    }

    // Load service categories if not already loaded
    loadServiceCategoriesForModal();

    if (service) {
        // Edit mode
        if (title) title.textContent = 'Edit Service';
        document.getElementById('service-modal-id').value = service.id;
        document.getElementById('service-modal-name').value = service.name;
        document.getElementById('service-modal-category').value = service.category_id;
        document.getElementById('service-modal-cost').value = parseFloat(service.cost_price);
        document.getElementById('service-modal-mrp').value = parseFloat(service.mrp);
        document.getElementById('service-modal-daily').value = service.is_daily_charge ? 'true' : 'false';
        document.getElementById('service-modal-visits').value = service.visits_per_day || 1;
        document.getElementById('service-modal-submit-btn').textContent = 'Save Changes';
    } else {
        // Add mode
        if (title) title.textContent = 'Add Service';
        if (form) form.reset();
        document.getElementById('service-modal-id').value = '';
        document.getElementById('service-modal-visits').value = '1';
        document.getElementById('service-modal-submit-btn').textContent = 'Add Service';
    }

    // Show the modal
    modal.style.display = 'flex';
    
    // Focus the name input
    setTimeout(() => {
        const nameInput = document.getElementById('service-modal-name');
        if (nameInput) nameInput.focus();
    }, 100);
};

// Global function for closing service modal
window.closeServiceModal = function() {
    const modal = document.getElementById('service-modal');
    if (modal) modal.style.display = 'none';
};

// Load service categories for the modal
async function loadServiceCategoriesForModal() {
    try {
        const response = await fetch('/api/service-categories');
        const categories = await response.json();
        
        const select = document.getElementById('service-modal-category');
        if (select && select.children.length <= 1) { // Only load if not already loaded
            select.innerHTML = '<option value="">Select Category</option>';
            categories.forEach(cat => {
                select.innerHTML += `<option value="${cat.id}">${cat.display_name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading service categories:', error);
    }
}

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
                    window.loadDiscounts();
                } else if (tabName === 'saved-estimates') {
                    loadSavedEstimates();
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

    // Service modal form submission
    const serviceModalForm = document.getElementById('service-modal-form');
    if (serviceModalForm) {
        serviceModalForm.addEventListener('submit', handleServiceModalSubmit);
    }

    const discountForm = document.getElementById('discount-form');
    if (discountForm) {
        discountForm.addEventListener('submit', handleDiscountSubmit);
    }

    // Bulk upload
    const uploadBtn = document.getElementById('upload-csv-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');

    if (uploadBtn) uploadBtn.addEventListener('click', handleBulkUpload);
    if (downloadTemplateBtn) downloadTemplateBtn.addEventListener('click', downloadTemplate);

    // File input handling
    const fileInput = document.getElementById('csv-file-input');
    const fileInputContainer = document.getElementById('file-input-container');
    const fileSelectedContainer = document.getElementById('file-selected-container');
    const selectedFileName = document.getElementById('selected-file-name');

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                selectedFileName.textContent = file.name;
                fileInputContainer.style.display = 'none';
                fileSelectedContainer.style.display = 'block';
            }
        });
    }

    // Global function for removing file
    window.removeFile = function() {
        fileInput.value = '';
        selectedFileName.textContent = 'No file selected';
        fileInputContainer.style.display = 'block';
        fileSelectedContainer.style.display = 'none';
    };

    // Discount modal button
    const addDiscountBtn = document.getElementById('add-discount-btn');
    if (addDiscountBtn) {
        addDiscountBtn.addEventListener('click', () => {
            openDiscountModal();
        });
    }

    // Sub-tab handling for Discounts
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    subTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const subtab = this.getAttribute('data-subtab');
            window.showDiscountSubTab(subtab);
        });
    });

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

    // Sub-tab functionality for Discounts tab
    window.showDiscountSubTab = function(subtabName) {
        // Update sub-tab buttons
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.borderBottomColor = 'transparent';
        });
        
        // Show active sub-tab button
        const activeBtn = document.querySelector(`[data-subtab="${subtabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.borderBottomColor = 'var(--primary)';
        }
        
        // Update sub-tab content
        document.querySelectorAll('.sub-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = document.getElementById(`${subtabName}-subtab`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
        
        // Initialize bulk upload handlers if switching to bulk upload tab
        if (subtabName === 'bulk-upload-discounts') {
            initializeBulkDiscountHandlers();
        }
    }

    // Initialize bulk discount upload handlers
    function initializeBulkDiscountHandlers() {
        const discountFileInput = document.getElementById('discount-csv-file-input');
        const discountFileInputContainer = document.getElementById('discount-file-input-container');
        const discountFileSelectedContainer = document.getElementById('discount-file-selected-container');
        const discountSelectedFileName = document.getElementById('discount-selected-file-name');
        const uploadDiscountBtn = document.getElementById('upload-discount-btn');
        const downloadDiscountTemplateBtn = document.getElementById('download-discount-template-btn');

        if (discountFileInput) {
            discountFileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    discountSelectedFileName.textContent = file.name;
                    discountFileInputContainer.style.display = 'none';
                    discountFileSelectedContainer.style.display = 'block';
                }
            });
        }

        if (uploadDiscountBtn) uploadDiscountBtn.addEventListener('click', handleBulkDiscountUpload);
        if (downloadDiscountTemplateBtn) downloadDiscountTemplateBtn.addEventListener('click', downloadDiscountTemplate);

        // Global function for removing discount file
        window.removeDiscountFile = function() {
            discountFileInput.value = '';
            discountSelectedFileName.textContent = 'No file selected';
            discountFileInputContainer.style.display = 'block';
            discountFileSelectedContainer.style.display = 'none';
        };
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
        // Store estimate data globally for saving
        window.currentEstimateData = estimate;
        
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

    // Save estimate function
    window.saveEstimate = async function() {
        const estimateDetails = document.getElementById('estimate-details');
        
        if (!estimateDetails || estimateDetails.style.display === 'none') {
            showMessage('Please generate an estimate first', 'error');
            return;
        }
        
        // Get current estimate data from the last generated estimate
        if (!window.currentEstimateData) {
            showMessage('No estimate data available. Please generate estimate again.', 'error');
            return;
        }
        
        try {
            // Get patient form data
            const patientName = document.getElementById('patient-name').value.trim();
            const patientUhid = document.getElementById('patient-uhid').value.trim();
            const patientCategory = document.getElementById('patient-category').value;
            const lengthOfStay = parseInt(document.getElementById('patient-stay').value);
            
            if (!patientName || !patientCategory || !lengthOfStay) {
                showMessage('Patient information is incomplete', 'error');
                return;
            }
            
            // Show loading state
            const saveBtn = document.querySelector('button[onclick="saveEstimate()"]');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;
            
            // Prepare save data
            const saveData = {
                patient_name: patientName,
                patient_uhid: patientUhid,
                patient_category: patientCategory,
                length_of_stay: lengthOfStay,
                estimate_data: window.currentEstimateData
            };
            
            // Call save API
            const response = await fetch('/api/save-estimate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showMessage(`Estimate saved successfully! Estimate Number: ${result.estimate_number}`, 'success');
            } else {
                showMessage(result.error || 'Error saving estimate', 'error');
            }
            
        } catch (error) {
            console.error('Error saving estimate:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            const saveBtn = document.querySelector('button[onclick="saveEstimate()"]');
            saveBtn.textContent = 'Save Estimate';
            saveBtn.disabled = false;
        }
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
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-outline btn-sm" onclick="editService(${service.id})">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id})">Delete</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading services:', error);
        }
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

    // Handle service modal form submission
    async function handleServiceModalSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('service-modal-id').value;
        const formData = {
            name: document.getElementById('service-modal-name').value,
            category_id: parseInt(document.getElementById('service-modal-category').value),
            cost_price: parseFloat(document.getElementById('service-modal-cost').value),
            mrp: parseFloat(document.getElementById('service-modal-mrp').value),
            is_daily_charge: document.getElementById('service-modal-daily').value === 'true',
            visits_per_day: parseInt(document.getElementById('service-modal-visits').value) || 1
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
                // Close modal and reset
                window.closeServiceModal();
                document.getElementById('service-modal-form').reset();
                document.getElementById('service-modal-visits').value = '1';
                document.getElementById('service-modal-id').value = '';

                // Refresh lists
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
    window.loadDiscounts = async function() {
        try {
            const response = await fetch('/api/discounts');
            const discounts = await response.json();

            const tbody = document.getElementById('discounts-tbody');
            if (!tbody) {
                console.error('Discounts table body not found');
                return;
            }
            
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
            console.log(`Loaded ${discounts.length} discounts into table`);
        } catch (error) {
            console.error('Error loading discounts:', error);
            throw error; // Re-throw so caller can handle it
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
                window.loadDiscounts();
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
                window.loadDiscounts();
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
        const fileInput = document.getElementById('csv-file-input');
        const file = fileInput.files[0];

        if (!file) {
            showMessage('Please select a CSV or Excel file', 'error');
            return;
        }

        // Check file type
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
            showMessage('Please upload only CSV (.csv) or Excel (.xlsx, .xls) files', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/bulk-upload/services', {
                method: 'POST',
                body: formData
            });

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error('JSON parsing error:', jsonError);
                showMessage('Invalid server response. Please try again.', 'error');
                return;
            }

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
                
                // Reset file input UI
                fileInput.value = '';
                selectedFileName.textContent = 'No file selected';
                fileInputContainer.style.display = 'block';
                fileSelectedContainer.style.display = 'none';
            } else {
                showMessage(result.error || 'Error uploading services', 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
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

    // Saved Estimates Management
    let currentViewMode = 'mine'; // 'mine' or 'all'

    async function loadSavedEstimates() {
        try {
            const viewAll = currentViewMode === 'all' ? 'true' : 'false';
            const response = await fetch(`/api/saved-estimates?view_all=${viewAll}`);
            const estimates = await response.json();

            const tbody = document.getElementById('saved-estimates-tbody');
            tbody.innerHTML = '';

            if (estimates.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--muted-foreground);">No saved estimates found</td></tr>';
                return;
            }

            estimates.forEach(estimate => {
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid var(--border)';
                row.innerHTML = `
                    <td style="padding: 0.75rem;">${estimate.estimate_number}</td>
                    <td style="padding: 0.75rem;">${estimate.patient_name}</td>
                    <td style="padding: 0.75rem;">${estimate.patient_category}</td>
                    <td style="padding: 0.75rem;">₹${parseFloat(estimate.final_total).toFixed(2)}</td>
                    <td style="padding: 0.75rem;">
                        ${currentViewMode === 'all' ? `${estimate.generated_by_username} (${estimate.generated_by_role})` : estimate.generated_by_role}
                    </td>
                    <td style="padding: 0.75rem;">${new Date(estimate.created_at).toLocaleDateString('en-IN')}</td>
                    <td style="padding: 0.75rem;">
                        <button class="btn btn-outline btn-sm" onclick="viewSavedEstimate(${estimate.id})">View</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

        } catch (error) {
            console.error('Error loading saved estimates:', error);
            showMessage('Error loading saved estimates', 'error');
        }
    }

    // Toggle between My Estimates and All Estimates (Admin only)
    window.toggleEstimateView = function(viewMode) {
        currentViewMode = viewMode;
        
        // Update button states
        const myBtn = document.getElementById('my-estimates-btn');
        const allBtn = document.getElementById('all-estimates-btn');
        
        if (viewMode === 'mine') {
            myBtn.classList.add('active');
            allBtn.classList.remove('active');
        } else {
            allBtn.classList.add('active');
            myBtn.classList.remove('active');
        }
        
        // Reload estimates with new view mode
        loadSavedEstimates();
    };

    // View specific saved estimate
    window.viewSavedEstimate = async function(estimateId) {
        try {
            const response = await fetch(`/api/saved-estimates/${estimateId}`);
            const result = await response.json();
            
            if (response.ok) {
                // Display the saved estimate in the same format as generated estimate
                displayEstimate(result.estimate_data);
                
                // Close the masters modal
                document.getElementById('masters-modal').style.display = 'none';
                
                showMessage('Saved estimate loaded successfully', 'success');
            } else {
                showMessage(result.error || 'Error loading saved estimate', 'error');
            }
        } catch (error) {
            console.error('Error viewing saved estimate:', error);
            showMessage('Network error. Please try again.', 'error');
        }
    };
});

// Reports Modal functionality - for the main Reports button in navbar
function openReportsModal() {
    console.log('=== openReportsModal called ===');
    try {
        const modal = document.getElementById('reports-modal');
        console.log('Modal element found:', modal);
        if (modal) {
            modal.style.display = 'flex';
            console.log('Modal display set to flex');
            // Default to "My Estimates" view
            console.log('About to call toggleEstimateViewForReports("my")');
            toggleEstimateViewForReports('my');
            console.log('toggleEstimateViewForReports("my") completed');
            
            // Additional check - let's see if the modal is actually visible
            setTimeout(() => {
                console.log('Modal display after 1 second:', modal.style.display);
                const loadingDiv = document.getElementById('reports-loading');
                const contentDiv = document.getElementById('reports-content');
                console.log('Loading div display:', loadingDiv ? loadingDiv.style.display : 'not found');
                console.log('Content div display:', contentDiv ? contentDiv.style.display : 'not found');
            }, 1000);
        } else {
            console.error('Modal element with ID "reports-modal" not found!');
        }
    } catch (error) {
        console.error('Error in openReportsModal:', error);
    }
}

function closeReportsModal() {
    const modal = document.getElementById('reports-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load estimates for the main reports modal (with admin toggle functionality)
async function loadSavedEstimatesForReports(viewAll = false) {
    console.log('=== loadSavedEstimatesForReports called with viewAll:', viewAll, '===');
    const loadingDiv = document.getElementById('reports-loading');
    const contentDiv = document.getElementById('reports-content');
    const tableBody = document.getElementById('reports-table-body');
    const noEstimatesDiv = document.getElementById('no-estimates');
    
    console.log('DOM elements found:');
    console.log('- loadingDiv:', loadingDiv);
    console.log('- contentDiv:', contentDiv);
    console.log('- tableBody:', tableBody);
    console.log('- noEstimatesDiv:', noEstimatesDiv);
    
    // Show loading
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    console.log('Loading display set, content hidden');
    
    try {
        // For "My Estimates": don't send view_all parameter (defaults to user's own)
        // For "All Estimates": send view_all=true
        const url = viewAll ? '/api/saved-estimates?view_all=true' : '/api/saved-estimates';
        console.log('Fetching estimates from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const estimates = await response.json();
        console.log('Loaded estimates:', estimates);
        console.log('Number of estimates:', estimates.length);
        
        // Debug: Check each estimate's properties
        estimates.forEach((estimate, index) => {
            console.log(`Estimate ${index}:`, {
                id: estimate.id,
                estimate_number: estimate.estimate_number,
                patient_name: estimate.patient_name,
                patient_uhid: estimate.patient_uhid,
                generated_by: estimate.generated_by,
                total_amount: estimate.total_amount,
                created_at: estimate.created_at
            });
        });
        
        // Hide loading
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        
        if (estimates.length === 0) {
            tableBody.innerHTML = '';
            noEstimatesDiv.style.display = 'block';
            console.log('No estimates found, showing no estimates message');
            return;
        }
        
        noEstimatesDiv.style.display = 'none';
        console.log('About to populate table...');
        
        // Populate table with additional "Generated By" column for admin
        try {
            const tableHTML = estimates.map((estimate, index) => {
                console.log(`Processing estimate ${index}:`, estimate);
                
                // Safe property access
                const estimateNumber = estimate.estimate_number || 'N/A';
                const patientName = estimate.patient_name || 'N/A';
                const patientUhid = estimate.patient_uhid || 'N/A';
                const generatedBy = estimate.generated_by || 'N/A';
                const totalAmount = estimate.total_amount ? estimate.total_amount.toLocaleString() : '0';
                
                // Safe date parsing
                let dateString = 'N/A';
                let timeString = 'N/A';
                try {
                    if (estimate.created_at) {
                        const date = new Date(estimate.created_at);
                        dateString = date.toLocaleDateString();
                        timeString = date.toLocaleTimeString();
                    }
                } catch (dateError) {
                    console.error('Date parsing error for estimate', index, ':', dateError);
                    dateString = estimate.created_at || 'N/A';
                    timeString = '';
                }
                
                return `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">${estimateNumber}</td>
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">${patientName}</td>
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">${patientUhid}</td>
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">${generatedBy}</td>
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">₹${totalAmount}</td>
                        <td style="padding: 0.75rem; border-right: 1px solid var(--border);">${dateString} ${timeString}</td>
                        <td style="padding: 0.75rem;">
                            <button onclick="printSavedEstimateFromReports(${estimate.id})" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">Print</button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            console.log('Generated table HTML length:', tableHTML.length);
            tableBody.innerHTML = tableHTML;
            console.log('Table populated successfully');
            
        } catch (tableError) {
            console.error('Error populating table:', tableError);
            throw tableError;
        }
        
    } catch (error) {
        console.error('Error loading saved estimates:', error);
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 2rem; text-align: center; color: var(--destructive);">
                    Error loading saved estimates: ${error.message}. Please try again.
                </td>
            </tr>
        `;
    }
}

// Toggle between "My Estimates" and "All Estimates" for admin in Reports modal
function toggleEstimateViewForReports(viewType) {
    console.log('=== toggleEstimateViewForReports called with:', viewType, '===');
    try {
        const myBtn = document.getElementById('reports-my-estimates-btn');
        const allBtn = document.getElementById('reports-all-estimates-btn');
        
        console.log('My button found:', myBtn);
        console.log('All button found:', allBtn);
        
        if (viewType === 'my') {
            console.log('Setting up "My Estimates" view');
            if (myBtn) {
                myBtn.className = 'btn btn-primary';
                myBtn.style.pointerEvents = 'auto';
            }
            if (allBtn) {
                allBtn.className = 'btn btn-outline';
                allBtn.style.pointerEvents = 'auto';
            }
            console.log('About to call loadSavedEstimatesForReports(false)');
            loadSavedEstimatesForReports(false);
        } else {
            console.log('Setting up "All Estimates" view');
            if (myBtn) {
                myBtn.className = 'btn btn-outline';
                myBtn.style.pointerEvents = 'auto';
            }
            if (allBtn) {
                allBtn.className = 'btn btn-primary';
                allBtn.style.pointerEvents = 'auto';
            }
            console.log('About to call loadSavedEstimatesForReports(true)');
            loadSavedEstimatesForReports(true);
        }
        console.log('toggleEstimateViewForReports completed');
    } catch (error) {
        console.error('Error in toggleEstimateViewForReports:', error);
    }
}

// View saved estimate from reports modal - load into main dashboard
async function viewSavedEstimateFromReports(estimateId) {
    try {
        const response = await fetch(`/api/saved-estimates/${estimateId}`);
        if (!response.ok) {
            throw new Error('Failed to load estimate details');
        }
        
        const estimate = await response.json();
        const estimateData = JSON.parse(estimate.estimate_data);
        
        // Close reports modal first
        closeReportsModal();
        
        // Load the estimate data into the main form
        document.getElementById('patient-name').value = estimate.patient_name;
        document.getElementById('patient-uhid').value = estimate.patient_uhid;
        document.getElementById('patient-stay').value = estimateData.patient.lengthOfStay;
        document.getElementById('patient-category').value = estimateData.patient.category;
        
        // Update patient summary
        updatePatientSummary();
        
        // Clear and set selected services
        selectedServices.clear();
        estimateData.services.forEach(service => {
            selectedServices.add(service.id);
        });
        
        // Reload current service category to show selected services
        const activeTab = document.querySelector('.service-tab-btn.active');
        if (activeTab) {
            const categoryName = activeTab.getAttribute('data-category');
            loadServicesByCategory(categoryName);
        }
        
        // Generate the estimate to show in summary
        setTimeout(() => {
            generateEstimate();
        }, 500);
        
        showMessage('Estimate loaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error loading estimate:', error);
        showMessage('Failed to load estimate. Please try again.', 'error');
    }
}

// Print saved estimate from reports modal
async function printSavedEstimateFromReports(estimateId) {
    console.log('🖨️ ADMIN: printSavedEstimateFromReports called with ID:', estimateId);
    try {
        console.log('🖨️ ADMIN: Fetching estimate details...');
        const response = await fetch(`/api/saved-estimates/${estimateId}`);
        console.log('🖨️ ADMIN: Response status:', response.status);
        if (!response.ok) {
            throw new Error('Failed to load estimate details');
        }
        
        const estimate = await response.json();
        console.log('🖨️ ADMIN: Estimate data received:', estimate);
        const estimateData = JSON.parse(estimate.estimate_data);
        console.log('🖨️ ADMIN: Parsed estimate data:', estimateData);
        console.log('🖨️ ADMIN: estimateData.patient:', estimateData.patient);
        console.log('🖨️ ADMIN: estimateData.estimate_lines:', estimateData.estimate_lines);
        console.log('🖨️ ADMIN: estimateData.summary:', estimateData.summary);
        
        // Reconstruct patient object if it doesn't exist in estimateData
        if (!estimateData.patient) {
            estimateData.patient = {
                name: estimate.patient_name,
                uhid: estimate.patient_uhid,
                category: estimate.patient_category || 'N/A',
                lengthOfStay: estimate.length_of_stay || 1
            };
            console.log('🖨️ ADMIN: Reconstructed patient object:', estimateData.patient);
        }
        
        // Create print window with estimate data
        console.log('🖨️ ADMIN: Creating print window...');
        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        console.log('🖨️ ADMIN: Print window created:', printWindow);
        
        if (!printWindow) {
            throw new Error('Print window could not be opened. Please check popup blocker settings.');
        }
        
        // Build the estimate HTML content using the original format
        let estimateHTML = `
            <div class="invoice-header" style="border-bottom: 2px solid var(--border); padding-bottom: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: var(--primary);">MEDICAL ESTIMATE</h4>
                <div style="font-size: 0.875rem; color: var(--muted-foreground);">
                    <div><strong>Generated:</strong> ${new Date(estimate.created_at).toLocaleDateString()} at ${new Date(estimate.created_at).toLocaleTimeString()}</div>
                    <div><strong>Generated by:</strong> ${estimateData.generated_by || 'Admin'}</div>
                    <div><strong>Estimate Number:</strong> ${estimate.estimate_number}</div>
                </div>
            </div>
            
            <div class="patient-info" style="background: var(--accent); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <h5 style="margin: 0 0 0.5rem 0;">Patient Information</h5>
                <div style="font-size: 0.875rem;">
                    <div><strong>Name:</strong> ${estimateData.patient.name}</div>
                    <div><strong>UHID:</strong> ${estimateData.patient.uhid || 'N/A'}</div>
                    <div><strong>Category:</strong> ${estimateData.patient.category}</div>
                    <div><strong>Length of Stay:</strong> ${estimateData.patient.lengthOfStay} day(s)</div>
                </div>
            </div>
            
            <div class="services-breakdown" style="margin-bottom: 1rem;">
                <h5 style="margin: 0 0 0.75rem 0;">Services & Charges</h5>
                <div class="services-table">
                    ${estimateData.estimate_lines.map(line => `
                        <div class="estimate-line-item" style="border-bottom: 1px solid var(--border); padding: 0.75rem 0;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.25rem;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${line.service_name}</div>
                                    <div style="font-size: 0.75rem; color: var(--muted-foreground);">${line.category || 'Service'}</div>
                                </div>
                                <div style="text-align: right; min-width: 100px;">
                                    <div style="font-weight: 600;">₹${line.final_amount.toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--muted-foreground); display: flex; justify-content: space-between;">
                                <span>₹${line.unit_price.toFixed(2)} × ${line.quantity} = ₹${(line.unit_price * line.quantity).toFixed(2)}</span>
                                ${line.discount_amount > 0 ? `<span style="color: var(--primary);">-₹${line.discount_amount.toFixed(2)} discount</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="estimate-summary" style="background: var(--accent); padding: 1rem; border-radius: 6px;">
                <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Subtotal:</span>
                    <span>₹${estimateData.summary.subtotal.toFixed(2)}</span>
                </div>
                ${estimateData.summary.total_discount > 0 ? `
                <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--primary);">
                    <span>Total Discount:</span>
                    <span>-₹${estimateData.summary.total_discount.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="summary-line" style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 600; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                    <span>Total Amount:</span>
                    <span style="color: var(--primary);">₹${estimateData.summary.final_total.toFixed(2)}</span>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; font-size: 0.875rem;">
                <strong>Note:</strong> This is an estimated cost. Actual charges may vary based on treatment requirements and additional services.
            </div>
        `;
        
        console.log('🖨️ ADMIN: Writing HTML to print window...');
        printWindow.document.write(`
            <html>
            <head>
                <title>Medical Estimate ${estimate.estimate_number} - Print Preview</title>
                <style>
                    :root {
                        --primary: #0066cc;
                        --border: #ddd;
                        --accent: #f8f9fa;
                        --muted-foreground: #666;
                    }
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
                        ${estimateHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
        
        console.log('🖨️ ADMIN: HTML written, closing document and focusing...');
        printWindow.document.close();
        printWindow.focus();
        console.log('🖨️ ADMIN: Print window setup complete!');
        
    } catch (error) {
        console.error('🖨️ ADMIN: Error printing estimate:', error);
        showMessage('Failed to print estimate. Please try again.', 'error');
    }
}

// Bulk Discount Upload
async function handleBulkDiscountUpload() {
    const fileInput = document.getElementById('discount-csv-file-input');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV or Excel file', 'error');
        return;
    }

    // Check file type
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
        showMessage('Please upload only CSV (.csv) or Excel (.xlsx, .xls) files', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/bulk-upload/discounts', {
            method: 'POST',
            body: formData
        });

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            showMessage('Invalid server response. Please try again.', 'error');
            return;
        }

        if (response.ok) {
            const resultDiv = document.getElementById('discount-upload-result');
            let html = `<div class="alert alert-success">
                Successfully uploaded ${result.success_count} discounts!
            </div>`;

            if (result.errors && result.errors.length > 0) {
                html += `<div class="alert alert-error">
                    <strong>Errors:</strong><br>
                    ${result.errors.join('<br>')}
                </div>`;
            }

            resultDiv.innerHTML = html;
            
            // Auto-clear the success message after 3 seconds with smooth fade-out
            setTimeout(() => {
                const currentContent = resultDiv.innerHTML;
                // Only clear if it still contains our success message (user hasn't done another upload)
                if (currentContent.includes('Successfully uploaded')) {
                    // Add fade-out transition
                    resultDiv.style.transition = 'opacity 0.5s ease-out';
                    resultDiv.style.opacity = '0';
                    
                    // Remove content after fade-out completes
                    setTimeout(() => {
                        resultDiv.innerHTML = '';
                        resultDiv.style.opacity = '1';
                        resultDiv.style.transition = '';
                    }, 500);
                }
            }, 3000);
            
            // Reset file input UI first
            fileInput.value = '';
            document.getElementById('discount-selected-file-name').textContent = 'No file selected';
            document.getElementById('discount-file-input-container').style.display = 'block';
            document.getElementById('discount-file-selected-container').style.display = 'none';
            
            // Switch back to Manage Discounts tab to show updated table
            window.showDiscountSubTab('manage-discounts');
            
            // Refresh table in a separate context to avoid affecting main upload flow
            refreshDiscountTableAfterUpload();
            
        } else {
            showMessage(result.error || 'Error uploading discounts', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Separate function to refresh discount table after upload
async function refreshDiscountTableAfterUpload() {
    // Add small delay to ensure database operations are complete
    setTimeout(async () => {
        try {
            console.log('Refreshing discount table after bulk upload...');
            await window.loadDiscounts();
            console.log('Discount table refreshed successfully after bulk upload');
        } catch (loadError) {
            console.error('Error refreshing discounts list:', loadError);
            // Fallback: try refreshing again after another delay
            setTimeout(async () => {
                try {
                    console.log('Retrying discount table refresh...');
                    await window.loadDiscounts();
                    console.log('Discount table refresh retry successful');
                } catch (retryError) {
                    console.error('Retry refresh also failed:', retryError);
                    // Silent fail - don't show error to user since upload was successful
                }
            }, 1000);
        }
    }, 500);
}

// Download Discount Template
async function downloadDiscountTemplate() {
    try {
        const response = await fetch('/api/bulk-upload/discounts/template');
        
        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            showMessage('Invalid server response. Please try again.', 'error');
            return;
        }
        
        if (response.ok) {
            const blob = new Blob([result.template], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'discounts_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            showMessage('Error downloading template', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}