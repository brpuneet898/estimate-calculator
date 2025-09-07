// User Dashboard JavaScript - Same 3-column layout as admin but no Masters access

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

document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    checkAuthStatus();
    loadServiceCategoryTabs();
    
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
            const response = await fetch('/api/service-categories');
            const categories = await response.json();
            
            const tabsContainer = document.getElementById('service-category-tabs');
            if (!tabsContainer) return;
            
            categories.forEach((category, index) => {
                const btn = document.createElement('button');
                btn.className = `service-tab-btn ${index === 0 ? 'active' : ''}`;
                btn.setAttribute('data-category', category.name);
                btn.textContent = category.display_name;
                
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.service-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    loadServicesByCategory(category.name);
                });
                
                tabsContainer.appendChild(btn);
            });
            
            if (categories.length > 0) {
                loadServicesByCategory(categories[0].name);
            }
        } catch (error) {
            console.error('Error loading service categories:', error);
        }
    }

    // Auth check
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/user-info');
            if (response.ok) {
                const userData = await response.json();
                document.getElementById('user-name').textContent = userData.username;
                
                // Check if user is approved and is regular user
                if (!userData.approved) {
                    window.location.href = '/dashboard'; // Will redirect to pending page
                } else if (userData.is_admin || userData.is_manager) {
                    // Don't redirect users to /dashboard - that causes a loop!
                    // Instead redirect to login if they're admin/manager (shouldn't happen)
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

    // Load services by category for main interface (read-only for users)
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
                <div class="invoice-header" style="border-bottom: 2px solid #ddd; padding-bottom: 1rem; margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #0066cc;">MEDICAL ESTIMATE</h4>
                    <div style="font-size: 0.875rem; color: #666;">
                        <div><strong>Generated:</strong> ${estimate.generated_at}</div>
                        <div><strong>Generated by:</strong> ${estimate.generated_by}</div>
                    </div>
                </div>
                
                <div class="patient-info" style="background: #f8f9fa; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
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
                            <div class="estimate-line-item" style="border-bottom: 1px solid #ddd; padding: 0.75rem 0;">
                                <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.25rem;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600;">${line.service_name}</div>
                                        <div style="font-size: 0.75rem; color: #666;">${line.category} • ${line.unit_description}</div>
                                    </div>
                                    <div style="text-align: right; min-width: 100px;">
                                        <div style="font-weight: 600;">₹${line.final_amount.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div style="font-size: 0.75rem; color: #666; display: flex; justify-content: space-between;">
                                    <span>₹${line.unit_price.toFixed(2)} × ${line.quantity} = ₹${line.line_total.toFixed(2)}</span>
                                    ${line.discount_amount > 0 ? `<span style="color: #0066cc;">-₹${line.discount_amount.toFixed(2)} (${line.discount_percentage}% off)</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="estimate-summary" style="background: #f8f9fa; padding: 1rem; border-radius: 6px;">
                    <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Subtotal:</span>
                        <span>₹${estimate.summary.subtotal.toFixed(2)}</span>
                    </div>
                    ${estimate.summary.total_discount > 0 ? `
                    <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #0066cc;">
                        <span>Total Discount (${estimate.summary.discount_percentage}%):</span>
                        <span>-₹${estimate.summary.total_discount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="summary-line" style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 600; border-top: 1px solid #ddd; padding-top: 0.5rem;">
                        <span>Total Amount:</span>
                        <span style="color: #0066cc;">₹${estimate.summary.final_total.toFixed(2)}</span>
                    </div>
                </div>
                
                <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; font-size: 0.875rem;">
                    <strong>Note:</strong> This is an estimated cost. Actual charges may vary based on treatment requirements and additional services.
                </div>
            `;
        }
    }

    // Global function to select a service (for backward compatibility)
    window.selectService = function(serviceId) {
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

    // Global logout function
    window.logout = async function() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                showMessage('Logged out successfully!', 'success');
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

// Reports functionality
function openReportsModal() {
    const modal = document.getElementById('reports-modal');
    if (modal) {
        modal.style.display = 'flex';
        loadSavedEstimates();
    }
}

function closeReportsModal() {
    const modal = document.getElementById('reports-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadSavedEstimates() {
    const loadingDiv = document.getElementById('reports-loading');
    const contentDiv = document.getElementById('reports-content');
    const tableBody = document.getElementById('reports-table-body');
    const noEstimatesDiv = document.getElementById('no-estimates');
    
    // Show loading
    loadingDiv.style.display = 'block';
    contentDiv.style.display = 'none';
    
    try {
        console.log('Fetching saved estimates...');
        const response = await fetch('/api/saved-estimates');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const estimates = await response.json();
        console.log('Loaded estimates:', estimates);
        
        // Hide loading
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        
        if (estimates.length === 0) {
            tableBody.innerHTML = '';
            noEstimatesDiv.style.display = 'block';
            return;
        }
        
        noEstimatesDiv.style.display = 'none';
        
        // Populate table
        tableBody.innerHTML = estimates.map(estimate => `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 0.75rem; border-right: 1px solid #ddd;">${estimate.estimate_number}</td>
                <td style="padding: 0.75rem; border-right: 1px solid #ddd;">${estimate.patient_name}</td>
                <td style="padding: 0.75rem; border-right: 1px solid #ddd;">${estimate.patient_uhid}</td>
                <td style="padding: 0.75rem; border-right: 1px solid #ddd;">₹${estimate.total_amount.toLocaleString()}</td>
                <td style="padding: 0.75rem; border-right: 1px solid #ddd;">${new Date(estimate.created_at).toLocaleDateString()} ${new Date(estimate.created_at).toLocaleTimeString()}</td>
                <td style="padding: 0.75rem;">
                    <button onclick="printSavedEstimate(${estimate.id})" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;">Print</button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading saved estimates:', error);
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 2rem; text-align: center; color: #dc3545;">
                    Error loading saved estimates: ${error.message}. Please try again.
                </td>
            </tr>
        `;
    }
}

async function viewSavedEstimate(estimateId) {
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

async function printSavedEstimate(estimateId) {
    console.log('🖨️ USER: printSavedEstimate called with ID:', estimateId);
    try {
        console.log('🖨️ USER: Fetching estimate details...');
        const response = await fetch(`/api/saved-estimates/${estimateId}`);
        console.log('🖨️ USER: Response status:', response.status);
        if (!response.ok) {
            throw new Error('Failed to load estimate details');
        }
        
        const estimate = await response.json();
        console.log('🖨️ USER: Estimate data received:', estimate);
        const estimateData = JSON.parse(estimate.estimate_data);
        console.log('🖨️ USER: Parsed estimate data:', estimateData);
        console.log('🖨️ USER: estimateData.patient:', estimateData.patient);
        console.log('🖨️ USER: estimateData.estimate_lines:', estimateData.estimate_lines);
        console.log('🖨️ USER: estimateData.summary:', estimateData.summary);
        
        // Reconstruct patient object if it doesn't exist in estimateData
        if (!estimateData.patient) {
            estimateData.patient = {
                name: estimate.patient_name,
                uhid: estimate.patient_uhid,
                category: estimate.patient_category || 'N/A',
                lengthOfStay: estimate.length_of_stay || 1
            };
            console.log('🖨️ USER: Reconstructed patient object:', estimateData.patient);
        }
        
        // Create print window with estimate data
        console.log('🖨️ USER: Creating print window...');
        const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        console.log('🖨️ USER: Print window created:', printWindow);
        
        if (!printWindow) {
            throw new Error('Print window could not be opened. Please check popup blocker settings.');
        }
        
        // Build the estimate HTML content using the original format
        let estimateHTML = `
            <div class="invoice-header" style="border-bottom: 2px solid #ddd; padding-bottom: 1rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: #0066cc;">MEDICAL ESTIMATE</h4>
                <div style="font-size: 0.875rem; color: #666;">
                    <div><strong>Generated:</strong> ${new Date(estimate.created_at).toLocaleDateString()} at ${new Date(estimate.created_at).toLocaleTimeString()}</div>
                    <div><strong>Generated by:</strong> ${estimateData.generated_by || 'User'}</div>
                    <div><strong>Estimate Number:</strong> ${estimate.estimate_number}</div>
                </div>
            </div>
            
            <div class="patient-info" style="background: #f8f9fa; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
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
                        <div class="estimate-line-item" style="border-bottom: 1px solid #ddd; padding: 0.75rem 0;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.25rem;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${line.service_name}</div>
                                    <div style="font-size: 0.75rem; color: #666;">${line.category || 'Service'}</div>
                                </div>
                                <div style="text-align: right; min-width: 100px;">
                                    <div style="font-weight: 600;">₹${line.final_amount.toFixed(2)}</div>
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: #666; display: flex; justify-content: space-between;">
                                <span>₹${line.unit_price.toFixed(2)} × ${line.quantity} = ₹${(line.unit_price * line.quantity).toFixed(2)}</span>
                                ${line.discount_amount > 0 ? `<span style="color: #0066cc;">-₹${line.discount_amount.toFixed(2)} discount</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="estimate-summary" style="background: #f8f9fa; padding: 1rem; border-radius: 6px;">
                <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Subtotal:</span>
                    <span>₹${estimateData.summary.subtotal.toFixed(2)}</span>
                </div>
                ${estimateData.summary.total_discount > 0 ? `
                <div class="summary-line" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #0066cc;">
                    <span>Total Discount:</span>
                    <span>-₹${estimateData.summary.total_discount.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="summary-line" style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 600; border-top: 1px solid #ddd; padding-top: 0.5rem;">
                    <span>Total Amount:</span>
                    <span style="color: #0066cc;">₹${estimateData.summary.final_total.toFixed(2)}</span>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; font-size: 0.875rem;">
                <strong>Note:</strong> This is an estimated cost. Actual charges may vary based on treatment requirements and additional services.
            </div>
        `;
        
        console.log('🖨️ USER: Writing HTML to print window...');
        printWindow.document.write(`
            <html>
            <head>
                <title>Medical Estimate ${estimate.estimate_number} - Print Preview</title>
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
        
        console.log('🖨️ USER: HTML written, closing document and focusing...');
        printWindow.document.close();
        printWindow.focus();
        console.log('🖨️ USER: Print window setup complete!');
        
    } catch (error) {
        console.error('🖨️ USER: Error printing estimate:', error);
        showMessage('Failed to print estimate. Please try again.', 'error');
    }
}