// Configuration
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw7BA7U-aDZGNSzvBKSP5njdUhgfL9CK93JrMges6jFfZ8C8RQGrG1CANZObnUgs-kk/exec";

let submissionsData = [];
let lastUpdateTime = null;

// WhatsApp Functions
function formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let clean = phone.toString().replace(/\D/g, '');
    
    // If starts with 0, assume Sri Lanka and convert to international format
    if (clean.startsWith('0')) {
        return '+94' + clean.substring(1);
    }
    
    // If already has country code but without +, add it
    if (clean.startsWith('94') && clean.length === 11) {
        return '+' + clean;
    }
    
    // If already in international format, return as is
    if (clean.startsWith('94') && clean.length === 11) {
        return '+' + clean;
    }
    
    // If it's already in international format with +, return as is
    if (phone.toString().startsWith('+94')) {
        return phone.toString().replace(/\D/g, '');
    }
    
    // If we can't determine the format, return null
    if (clean.length < 9) {
        return null;
    }
    
    // Default: assume it's a Sri Lankan number without leading zero
    return '+94' + clean;
}

function createWhatsAppLink(phoneNumber, name = '') {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber) {
        return null;
    }

    const welcomeMessage = `Hello${name ? ' ' + name : ''}! Thank you for your form submission. We're contacting you from our support team. How can we assist you today?`;
    const encodedMessage = encodeURIComponent(welcomeMessage);
    
    return `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
}

function openWhatsApp(phoneNumber, name) {
    const whatsappLink = createWhatsAppLink(phoneNumber, name);
    
    if (whatsappLink) {
        window.open(whatsappLink, '_blank');
    } else {
        showSweetAlert('Invalid phone number format. Please check the contact number.', 'error');
    }
}

// Check authentication
function checkAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        console.log('User not authenticated');
        return false;
    }
    return true;
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Check authentication first
    if (!checkAuth()) {
        updateConnectionStatus('error', 'Please login to access dashboard');
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-danger">
                    <strong>Authentication Required</strong><br>
                    <small class="text-muted">Please login to access the dashboard</small>
                </td>
            </tr>
        `;
        return;
    }

    // Hide loading screen after 1.5 seconds
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 1500);

    // Load data immediately
    loadData();
    startTimer();
});

function loadData() {
    console.log('Loading data from:', SCRIPT_URL);
    
    // Check authentication before loading data
    if (!checkAuth()) {
        updateConnectionStatus('error', 'Authentication required');
        return;
    }

    // Update connection status
    updateConnectionStatus('loading', 'Loading data from server...');
    
    // Add refresh animation to button
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.classList.add('refresh-animation');
    refreshBtn.disabled = true;
    
    // Show loading state in table
    document.getElementById('tableBody').innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <br>
                <span class="text-muted">Fetching latest data...</span>
            </td>
        </tr>
    `;

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(SCRIPT_URL + '?action=getData&t=' + new Date().getTime(), {
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Data received:', data);
            
            if (data && data.result === 'success') {
                submissionsData = data.data || [];
                displayData(submissionsData);
                updateStats(submissionsData);
                updateConnectionStatus('connected', `Connected - ${submissionsData.length} records loaded`);
                
                // Add success animation
                document.querySelector('.table-container').classList.add('success-pulse');
                setTimeout(() => {
                    document.querySelector('.table-container').classList.remove('success-pulse');
                }, 600);
            } else {
                throw new Error(data?.message || 'Invalid response format from server');
            }
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            clearTimeout(timeoutId);
            
            let errorMessage = 'Failed to load data';
            if (error.name === 'AbortError') {
                errorMessage = 'Request timeout - server took too long to respond';
            } else if (error.message.includes('HTTP')) {
                errorMessage = `Server error: ${error.message}`;
            } else {
                errorMessage = `Network error: ${error.message}`;
            }
            
            updateConnectionStatus('error', errorMessage);
            document.getElementById('tableBody').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-danger">
                        ${errorMessage}<br>
                        <small class="text-muted">Please check your script URL and deployment</small>
                    </td>
                </tr>
            `;
        })
        .finally(() => {
            // Remove refresh animation
            setTimeout(() => {
                refreshBtn.classList.remove('refresh-animation');
                refreshBtn.disabled = false;
            }, 600);
            
            lastUpdateTime = new Date();
        });
}

function displayData(data) {
    const tableBody = document.getElementById('tableBody');
    const dataCount = document.getElementById('dataCount');
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div>🔭</div>
                    No submissions found<br>
                    <small class="text-muted">Data will appear here when forms are submitted</small>
                </td>
            </tr>
        `;
        dataCount.textContent = '0 records';
        return;
    }

    tableBody.innerHTML = data.map((row, index) => `
        <tr>
            <td><span class="timestamp">${row.Timestamp || 'N/A'}</span></td>
            <td><strong>${row.Name || 'N/A'}</strong></td>
            <td>${row.Email || 'N/A'}</td>
            <td>${row['Contact Number'] || 'N/A'}</td>
            <td><small class="text-muted">${row['Complete Address'] || 'N/A'}</small></td>
            <td><small class="text-muted">${row.Message || 'N/A'}</small></td>
            <td>
                ${row['Contact Number'] ? `
                    <button class="btn btn-whatsapp" onclick="openWhatsApp('${row['Contact Number']}', '${row.Name || ''}')" title="Contact via WhatsApp">
                        💬 Message
                    </button>
                ` : `
                    <span class="no-contact">No Contact</span>
                `}
            </td>
        </tr>
    `).join('');

    dataCount.textContent = `${data.length} records`;
}

function updateStats(data) {
    document.getElementById('totalSubmissions').textContent = data.length.toLocaleString();
    
    const today = new Date().toDateString();
    const todayCount = data.filter(item => {
        try {
            return new Date(item.Timestamp).toDateString() === today;
        } catch { return false; }
    }).length;
    
    document.getElementById('todaySubmissions').textContent = todayCount.toLocaleString();
}

function updateConnectionStatus(type, message) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = message;
    statusElement.className = `status-${type}`;
}

function startTimer() {
    setInterval(() => {
        if (lastUpdateTime) {
            const now = new Date();
            const diff = Math.floor((now - lastUpdateTime) / 1000);
            document.getElementById('dataAge').textContent = `${diff}s`;
        }
    }, 1000);
}

function exportToPDF() {
    if (submissionsData.length === 0) {
        showSweetAlert('No data available to export', 'warning');
        return;
    }

    const btn = document.getElementById('pdfBtn');
    btn.classList.add('loading');
    
    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Title
        doc.setFontSize(16);
        doc.setTextColor(44, 62, 80);
        doc.text('Form Submissions Report', 14, 15);
        
        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(108, 117, 125);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        doc.text(`Total Records: ${submissionsData.length}`, 14, 28);

        // Table
        doc.autoTable({
            startY: 35,
            head: [['Timestamp', 'Name', 'Email', 'Contact', 'Address', 'Notes']],
            body: submissionsData.map(row => [
                row.Timestamp || 'N/A',
                row.Name || 'N/A',
                row.Email || 'N/A',
                row['Contact Number'] || 'N/A',
                (row['Complete Address'] || 'N/A').substring(0, 30) + (row['Complete Address'] && row['Complete Address'].length > 30 ? '...' : ''),
                (row.Message || 'N/A').substring(0, 30) + (row.Message && row.Message.length > 30 ? '...' : '')
            ]),
            styles: { 
                fontSize: 7,
                textColor: [73, 80, 87]
            },
            headStyles: { 
                fillColor: [92, 184, 92],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250]
            }
        });

        doc.save(`submissions_report_${new Date().getTime()}.pdf`);
        btn.classList.remove('loading');
        showSweetAlert('PDF exported successfully!', 'success');
    }, 800);
}

function exportToCSV() {
    if (submissionsData.length === 0) {
        showSweetAlert('No data available to export', 'warning');
        return;
    }

    const btn = document.getElementById('csvBtn');
    btn.classList.add('loading');
    
    setTimeout(() => {
        let csv = 'Timestamp,Name,Email,Contact Number,Complete Address,Notes\n';
        
        submissionsData.forEach(row => {
            const escapeCsv = (str) => {
                if (!str) return '';
                return `"${String(str).replace(/"/g, '""')}"`;
            };
            
            csv += `${escapeCsv(row.Timestamp)},${escapeCsv(row.Name)},${escapeCsv(row.Email)},${escapeCsv(row['Contact Number'])},${escapeCsv(row['Complete Address'])},${escapeCsv(row.Message)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submissions_${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        btn.classList.remove('loading');
        showSweetAlert('CSV exported successfully!', 'success');
    }, 800);
}

function showSweetAlert(message, type = 'info') {
    Swal.fire({
        title: type === 'success' ? 'Success!' : 'Notice',
        text: message,
        icon: type,
        confirmButtonColor: '#5cb85c',
        confirmButtonText: 'OK'
    });
}

// Logout Functions
function showLogoutConfirmation() {
    document.getElementById('logoutModal').style.display = 'flex';
}

function cancelLogout() {
    document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
    localStorage.removeItem('adminLoggedIn');
    document.getElementById('logoutModal').style.display = 'none';
    showSweetAlert('Logged out successfully!', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// Auto-refresh every 30 seconds
setInterval(loadData, 30000);