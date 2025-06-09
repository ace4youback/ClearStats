document.addEventListener("DOMContentLoaded", function () {
    // --- DOM Element References ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusContainer = document.getElementById('status-container');
    const resultsArea = document.getElementById('results-area');
    const finalTotal = document.getElementById('final-total');
    const tableBody = document.getElementById('denomination-table-body');
    const filterInput = document.getElementById('filter-input');
    const historyList = document.getElementById('history-list');
    const chartCanvas = document.getElementById('denomination-chart');
    
    let chartInstance = null; // To hold the chart object
    const MAX_FILE_SIZE_MB = 5;

    // --- Main Event Listeners ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) handleFile(files[0]);
    });
    filterInput.addEventListener('keyup', filterTable);

    // --- File Handling Logic ---
    async function handleFile(file) {
        try {
            // 1. Validate file
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                throw new Error(`Kích thước tệp không được vượt quá ${MAX_FILE_SIZE_MB}MB.`);
            }
            updateStatus('processing', `Đang đọc tệp "${file.name}"...`);
            
            // 2. Parse file based on extension
            const extension = file.name.split('.').pop().toLowerCase();
            let numbers;
            switch (extension) {
                case 'txt':
                case 'csv':
                    const text = await file.text();
                    numbers = parseTextData(text);
                    break;
                case 'xls':
                case 'xlsx':
                    const buffer = await file.arrayBuffer();
                    numbers = parseExcelData(buffer);
                    break;
                default:
                    throw new Error("Định dạng tệp không được hỗ trợ. Vui lòng sử dụng .txt, .csv, hoặc .xlsx.");
            }
            
            // 3. Process data if valid numbers found
            if (!numbers || numbers.length === 0) {
                 throw new Error("Không tìm thấy dữ liệu số hợp lệ trong tệp.");
            }
            processData(numbers, file.name);

        } catch (error) {
            console.error("File handling error:", error);
            updateStatus('error', error.message);
        }
    }

    // --- Data Parsers ---
    function parseTextData(text) {
        // Matches numbers, including decimals, and ignores other text
        return text.match(/[0-9.]+/g)?.map(Number).filter(n => !isNaN(n)) || [];
    }

    function parseExcelData(buffer) {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Convert sheet to JSON, assuming numbers are in the first column
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let numbers = [];
        data.forEach(row => {
            if (row && typeof row[0] === 'number') {
                numbers.push(row[0]);
            }
        });
        return numbers;
    }

    // --- Core Data Processing ---
    function processData(numbers, fileName) {
        const frequencyMap = new Map();
        let totalSum = 0;

        for (const num of numbers) {
            frequencyMap.set(num, (frequencyMap.get(num) || 0) + 1);
            totalSum += num;
        }

        const sortedMap = new Map([...frequencyMap.entries()].sort((a, b) => a[0] - b[0]));
        
        updateUI(sortedMap, totalSum);
        saveToHistory({
            fileName,
            totalSum,
            count: numbers.length,
            date: new Date().toISOString()
        });
        updateStatus('success', `Phân tích thành công ${numbers.length} mục từ "${fileName}".`);
    }

    // --- UI Update Functions ---
    function updateUI(dataMap, totalSum) {
        resultsArea.classList.remove('d-none');
        finalTotal.textContent = formatValue(totalSum);
        updateTable(dataMap);
        updateChart(dataMap);
    }
    
    function updateTable(dataMap) {
        tableBody.innerHTML = '';
        if (dataMap.size === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Không có dữ liệu để hiển thị.</td></tr>';
            return;
        }
        dataMap.forEach((count, denomination) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatValue(denomination)}</td>
                <td class="text-center">${count.toLocaleString('vi-VN')}</td>
                <td class="text-end fw-bold">${formatValue(denomination * count)}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateChart(dataMap) {
        if (chartInstance) {
            chartInstance.destroy(); // Destroy old chart before creating new one
        }
        const labels = Array.from(dataMap.keys()).map(d => d.toLocaleString('vi-VN'));
        const data = Array.from(dataMap.values());

        chartInstance = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số lần xuất hiện',
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)', 'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Số lần' } } }
            }
        });
    }

    function updateStatus(type, message) {
        statusContainer.innerHTML = `<div class="alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;
    }

    // --- Feature Functions: Filter & History ---
    function filterTable() {
        const filterText = filterInput.value.toLowerCase();
        const rows = tableBody.getElementsByTagName('tr');
        for (const row of rows) {
            const denominationCell = row.getElementsByTagName('td')[0];
            if (denominationCell) {
                const cellText = denominationCell.textContent || denominationCell.innerText;
                row.style.display = cellText.toLowerCase().includes(filterText) ? '' : 'none';
            }
        }
    }
    
    function saveToHistory(entry) {
        let history = JSON.parse(localStorage.getItem('denoHistory')) || [];
        history.unshift(entry); // Add to the beginning
        if (history.length > 5) history = history.slice(0, 5); // Keep last 5
        localStorage.setItem('denoHistory', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('denoHistory')) || [];
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<li class="list-group-item text-muted">Chưa có lịch sử...</li>';
            return;
        }
        history.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'list-group-item history-item';
            const date = new Date(entry.date);
            li.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${entry.fileName}</h6>
                    <small>${date.toLocaleDateString('vi-VN')}</small>
                </div>
                <p class="mb-1">Tổng: <strong>${formatValue(entry.totalSum)}</strong> (${entry.count} mục)</p>
            `;
            historyList.appendChild(li);
        });
    }
    
    // --- Utility Functions ---
    function formatValue(value) {
        // Appends 'k' and formats the number
        return value.toLocaleString('vi-VN') + 'k';
    }

    // Initial load
    loadHistory();
});