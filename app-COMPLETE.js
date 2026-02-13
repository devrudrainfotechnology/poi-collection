// Global variables
let map;
let streetViewFrame;
let buildingMarker = null;
let displayMarker = null;
let kmlLayer = null;
let clickCount = 0;
let poiData = [];
let sessionCount = 0;
let currentTileLayer = null;
let categories = ['Retail', 'Restaurant', 'Office', 'Bank', 'Hospital', 'School', 'Pharmacy', 'Fuel Station', 'ATM'];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    initializeMap();
    loadSavedData();
    updateStats();
    updateCategoryList();
    
    // Form submission
    document.getElementById('poiForm').addEventListener('submit', function(e) {
        e.preventDefault();
        savePOI();
    });
    
    console.log('POI Collector initialized successfully');
});

// Load categories from localStorage
function loadCategories() {
    const saved = localStorage.getItem('categories');
    if (saved) {
        categories = JSON.parse(saved);
    }
    
    // Populate dropdown
    const select = document.getElementById('category');
    select.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

// Save categories to localStorage
function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
}

// Add new category
function addCategory() {
    const input = document.getElementById('newCategory');
    const newCat = input.value.trim();
    
    if (!newCat) {
        showAlert('Please enter a category name', 'warning');
        return;
    }
    
    if (categories.includes(newCat)) {
        showAlert('Category already exists', 'warning');
        return;
    }
    
    categories.push(newCat);
    saveCategories();
    loadCategories();
    updateCategoryList();
    input.value = '';
    showAlert(`Category "${newCat}" added successfully!`, 'success');
}

// Update category list display
function updateCategoryList() {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';
    
    categories.forEach((cat, index) => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <span>${cat}</span>
            <button onclick="removeCategory(${index})">Remove</button>
        `;
        list.appendChild(item);
    });
}

// Remove category
function removeCategory(index) {
    const cat = categories[index];
    if (confirm(`Remove category "${cat}"?`)) {
        categories.splice(index, 1);
        saveCategories();
        loadCategories();
        updateCategoryList();
        showAlert(`Category "${cat}" removed`, 'success');
    }
}

// Initialize Leaflet map
function initializeMap() {
    console.log('Initializing map...');
    
    // Initialize main map
    map = L.map('mainMap', {
        center: [20.5937, 78.9629], // Center of India
        zoom: 5,
        zoomControl: true,
        preferCanvas: false
    });

    // Default: OpenStreetMap
    currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Add click event to map
    map.on('click', handleMapClick);

    // Initialize street view iframe
    streetViewFrame = document.getElementById('streetViewFrame');
    updateStreetView(20.5937, 78.9629);
    
    console.log('Map initialized successfully');
}

// Change map type
function changeMapType() {
    const mapType = document.getElementById('mapTypeSelect').value;
    
    console.log('Changing map type to:', mapType);
    
    // Remove current tile layer
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    
    // Add new tile layer based on selection
    switch(mapType) {
        case 'osm':
            currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19
            }).addTo(map);
            break;
            
        case 'satellite':
            // Esri World Imagery (satellite)
            currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
                maxZoom: 19
            }).addTo(map);
            break;
            
        case 'google-satellite':
            // Google Satellite
            currentTileLayer = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google'
            }).addTo(map);
            break;
    }
    
    showAlert(`Map type changed to ${mapType === 'osm' ? 'OpenStreetMap' : 'Satellite'}`, 'success');
}

// Handle map clicks - AUTO-SAVE COORDINATES
function handleMapClick(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    
    console.log(`Map clicked at: ${lat}, ${lng}`);

    if (clickCount === 0) {
        // First click - Building location (Blue marker)
        if (buildingMarker) {
            map.removeLayer(buildingMarker);
        }
        
        buildingMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        
        buildingMarker.bindPopup('<b>🔵 Building Location</b><br>Click again for Display location').openPopup();
        
        // AUTO-SAVE coordinates to form
        document.getElementById('buildLat').value = lat;
        document.getElementById('buildLon').value = lng;
        
        // Auto-save to localStorage immediately
        localStorage.setItem('lastBuildingLat', lat);
        localStorage.setItem('lastBuildingLng', lng);
        
        clickCount = 1;
        showAlert('✓ Building location saved! Click again for Display location.', 'success');
        
    } else if (clickCount === 1) {
        // Second click - Display location (Red marker)
        if (displayMarker) {
            map.removeLayer(displayMarker);
        }
        
        displayMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        
        displayMarker.bindPopup('<b>🔴 Display Location</b><br>Street View updated!').openPopup();
        
        // AUTO-SAVE coordinates to form
        document.getElementById('displayLat').value = lat;
        document.getElementById('displayLon').value = lng;
        
        // Auto-save to localStorage immediately
        localStorage.setItem('lastDisplayLat', lat);
        localStorage.setItem('lastDisplayLng', lng);
        
        // Update street view with FULL ACCESS
        updateStreetView(lat, lng);
        
        clickCount = 0;
        showAlert('✓ Display location saved! Street View updated. Fill form and save POI.', 'success');
        
        // Focus on POI name field for quick data entry
        document.getElementById('poiName').focus();
    }
}

// Update Street View with FULL ACCESS
function updateStreetView(lat, lng) {
    // Use Google Maps Street View with full interactivity
    // This opens in iframe with full navigation capabilities
    const streetViewUrl = `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192?entry=ttu`;
    streetViewFrame.src = streetViewUrl;
    console.log(`Street View updated to: ${lat}, ${lng} with full access`);
}

// Save POI
function savePOI() {
    const buildLat = document.getElementById('buildLat').value;
    const buildLon = document.getElementById('buildLon').value;
    const displayLat = document.getElementById('displayLat').value;
    const displayLon = document.getElementById('displayLon').value;

    if (!buildLat || !buildLon || !displayLat || !displayLon) {
        showAlert('⚠ Please set both Building and Display locations on the map!', 'danger');
        return;
    }

    const poi = {
        POI_NAME: document.getElementById('poiName').value,
        CATEGORY: document.getElementById('category').value,
        SUB_CAT: document.getElementById('subCat').value,
        LANDLINE: document.getElementById('landline').value,
        MOBILE: document.getElementById('mobile').value,
        MOBILE_1: document.getElementById('mobile1').value,
        BUILD_LAT: buildLat,
        BUILD_LON: buildLon,
        DISPLAY_LAT: displayLat,
        DISPLAY_LON: displayLon,
        TIMESTAMP: new Date().toISOString(),
        DATE_COLLECTED: new Date().toLocaleDateString('en-IN')
    };

    poiData.push(poi);
    sessionCount++;
    
    // Save to localStorage
    localStorage.setItem('poiData', JSON.stringify(poiData));
    
    showAlert(`✓ POI "${poi.POI_NAME}" saved! Total: ${poiData.length}`, 'success');
    
    updateStats();
    resetForm();
    
    console.log('POI saved:', poi);
}

// Reset form
function resetForm() {
    document.getElementById('poiForm').reset();
    document.getElementById('buildLat').value = '';
    document.getElementById('buildLon').value = '';
    document.getElementById('displayLat').value = '';
    document.getElementById('displayLon').value = '';
    
    if (buildingMarker) {
        map.removeLayer(buildingMarker);
        buildingMarker = null;
    }
    
    if (displayMarker) {
        map.removeLayer(displayMarker);
        displayMarker = null;
    }
    
    clickCount = 0;
    document.getElementById('poiName').focus();
}

// Load saved data
function loadSavedData() {
    const saved = localStorage.getItem('poiData');
    if (saved) {
        poiData = JSON.parse(saved);
        console.log('Loaded', poiData.length, 'POIs from storage');
    }
}

// Update statistics
function updateStats() {
    document.getElementById('totalPOIs').textContent = poiData.length;
    document.getElementById('sessionPOIs').textContent = sessionCount;
}

// Load KML file - ENHANCED WITH FULL FEATURE SUPPORT
function loadKML(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('Loading KML file:', file.name, 'Size:', file.size, 'bytes');

    const reader = new FileReader();
    reader.onload = function(e) {
        const kmlContent = e.target.result;
        console.log('KML content loaded, length:', kmlContent.length);
        parseAndDisplayKML(kmlContent, file.name);
    };
    reader.onerror = function(error) {
        console.error('File read error:', error);
        showAlert('❌ Failed to read file. Please try again.', 'danger');
    };
    reader.readAsText(file);
}

// Parse and display KML - COMPLETE FEATURE SUPPORT
function parseAndDisplayKML(kmlContent, fileName) {
    console.log('Parsing KML content for file:', fileName);
    
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        // Check for parse errors
        const parseError = xmlDoc.getElementsByTagName('parsererror');
        if (parseError.length > 0) {
            console.error('XML Parse Error:', parseError[0].textContent);
            showAlert('❌ Invalid KML format. File may be corrupted.', 'danger');
            return;
        }
        
        console.log('✓ KML parsed successfully');
        console.log('Root element:', xmlDoc.documentElement.tagName);
        
        // Remove existing KML layer
        if (kmlLayer) {
            map.removeLayer(kmlLayer);
            console.log('Removed previous KML layer');
        }
        
        kmlLayer = L.layerGroup().addTo(map);
        console.log('Created new KML layer');
        
        // Parse Placemarks
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        console.log('Found', placemarks.length, 'placemarks');
        
        let pointCount = 0;
        let polygonCount = 0;
        let lineCount = 0;
        let allBounds = [];
        
        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const name = placemark.getElementsByTagName('name')[0]?.textContent || `Feature ${i+1}`;
            const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
            
            console.log(`Processing placemark ${i+1}:`, name);
            
            // Try to find Point
            const point = placemark.getElementsByTagName('Point')[0];
            if (point) {
                const coords = point.getElementsByTagName('coordinates')[0]?.textContent;
                if (coords) {
                    const parts = coords.trim().split(',');
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const marker = L.marker([lat, lng], {
                            icon: L.icon({
                                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                iconSize: [25, 41],
                                iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowSize: [41, 41]
                            })
                        }).addTo(kmlLayer);
                        
                        marker.bindPopup(`
                            <div style="min-width: 200px;">
                                <h3 style="margin: 0 0 10px 0; color: #27ae60;">📍 ${name}</h3>
                                <p style="margin: 5px 0;">${description}</p>
                                <hr style="margin: 10px 0;">
                                <p style="margin: 0; font-size: 12px;">
                                    <strong>Lat:</strong> ${lat.toFixed(6)}<br>
                                    <strong>Lng:</strong> ${lng.toFixed(6)}
                                </p>
                            </div>
                        `);
                        
                        allBounds.push([lat, lng]);
                        pointCount++;
                        console.log(`  ✓ Added point at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    }
                }
            }
            
            // Try to find Polygon
            const polygon = placemark.getElementsByTagName('Polygon')[0];
            if (polygon) {
                const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
                if (outerBoundary) {
                    const linearRing = outerBoundary.getElementsByTagName('LinearRing')[0];
                    if (linearRing) {
                        const coords = linearRing.getElementsByTagName('coordinates')[0]?.textContent;
                        if (coords) {
                            const coordPairs = coords.trim().split(/\s+/);
                            const latlngs = [];
                            
                            for (let j = 0; j < coordPairs.length; j++) {
                                const parts = coordPairs[j].split(',');
                                if (parts.length >= 2) {
                                    const lng = parseFloat(parts[0]);
                                    const lat = parseFloat(parts[1]);
                                    if (!isNaN(lat) && !isNaN(lng)) {
                                        latlngs.push([lat, lng]);
                                        allBounds.push([lat, lng]);
                                    }
                                }
                            }
                            
                            if (latlngs.length >= 3) {
                                const poly = L.polygon(latlngs, {
                                    color: '#27ae60',
                                    fillColor: '#2ecc71',
                                    fillOpacity: 0.35,
                                    weight: 3,
                                    opacity: 0.8
                                }).addTo(kmlLayer);
                                
                                const bounds = poly.getBounds();
                                const center = bounds.getCenter();
                                
                                poly.bindPopup(`
                                    <div style="min-width: 200px;">
                                        <h3 style="margin: 0 0 10px 0; color: #27ae60;">⬟ ${name}</h3>
                                        <p style="margin: 5px 0;">${description}</p>
                                        <hr style="margin: 10px 0;">
                                        <p style="margin: 0; font-size: 12px;">
                                            <strong>Type:</strong> Polygon<br>
                                            <strong>Vertices:</strong> ${latlngs.length}<br>
                                            <strong>Center:</strong> ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}
                                        </p>
                                    </div>
                                `);
                                
                                // Add hover effect
                                poly.on('mouseover', function() {
                                    this.setStyle({ fillOpacity: 0.6, weight: 4 });
                                });
                                poly.on('mouseout', function() {
                                    this.setStyle({ fillOpacity: 0.35, weight: 3 });
                                });
                                
                                polygonCount++;
                                console.log(`  ✓ Added polygon with ${latlngs.length} points, center at ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
                            }
                        }
                    }
                }
            }
            
            // Try to find LineString
            const lineString = placemark.getElementsByTagName('LineString')[0];
            if (lineString) {
                const coords = lineString.getElementsByTagName('coordinates')[0]?.textContent;
                if (coords) {
                    const coordPairs = coords.trim().split(/\s+/);
                    const latlngs = [];
                    
                    for (let j = 0; j < coordPairs.length; j++) {
                        const parts = coordPairs[j].split(',');
                        if (parts.length >= 2) {
                            const lng = parseFloat(parts[0]);
                            const lat = parseFloat(parts[1]);
                            if (!isNaN(lat) && !isNaN(lng)) {
                                latlngs.push([lat, lng]);
                                allBounds.push([lat, lng]);
                            }
                        }
                    }
                    
                    if (latlngs.length >= 2) {
                        const line = L.polyline(latlngs, {
                            color: '#3498db',
                            weight: 3,
                            opacity: 0.7
                        }).addTo(kmlLayer);
                        
                        line.bindPopup(`
                            <div style="min-width: 200px;">
                                <h3 style="margin: 0 0 10px 0; color: #3498db;">━ ${name}</h3>
                                <p style="margin: 5px 0;">${description}</p>
                                <hr style="margin: 10px 0;">
                                <p style="margin: 0; font-size: 12px;">
                                    <strong>Type:</strong> Line<br>
                                    <strong>Points:</strong> ${latlngs.length}
                                </p>
                            </div>
                        `);
                        
                        lineCount++;
                        console.log(`  ✓ Added line with ${latlngs.length} points`);
                    }
                }
            }
        }
        
        const totalCount = pointCount + polygonCount + lineCount;
        console.log(`✓ Total features loaded: ${totalCount} (${pointCount} points, ${polygonCount} polygons, ${lineCount} lines)`);
        
        // Show status
        let infoText = `${fileName}: `;
        if (pointCount > 0) infoText += `${pointCount} point(s) `;
        if (polygonCount > 0) infoText += `${polygonCount} polygon(s) `;
        if (lineCount > 0) infoText += `${lineCount} line(s)`;
        
        document.getElementById('kmlFileName').textContent = infoText;
        document.getElementById('kmlStatus').style.display = 'block';
        
        if (totalCount > 0) {
            showAlert(`✓ KML loaded! ${pointCount} points, ${polygonCount} polygons, ${lineCount} lines`, 'success');
            
            // Fit map to features with better bounds calculation
            setTimeout(() => {
                try {
                    if (allBounds.length > 0) {
                        const bounds = L.latLngBounds(allBounds);
                        console.log('Fitting map to bounds:', bounds.toBBoxString());
                        map.fitBounds(bounds, { 
                            padding: [100, 100],
                            maxZoom: 15,
                            animate: true,
                            duration: 1
                        });
                        console.log('✓ Map zoomed to show all KML features');
                    }
                } catch (e) {
                    console.error('Could not fit bounds:', e);
                }
            }, 300);
        } else {
            showAlert('⚠ KML loaded but no features found. Check if file contains valid coordinates.', 'warning');
        }
        
    } catch (error) {
        console.error('KML Parse Error:', error);
        console.error('Error stack:', error.stack);
        showAlert('❌ Error loading KML: ' + error.message, 'danger');
    }
}

// Export to Excel
function exportToExcel() {
    if (poiData.length === 0) {
        showAlert('⚠ No data to export! Please collect some POIs first.', 'danger');
        return;
    }

    const exportData = poiData.map(poi => ({
        'POI_NAME': poi.POI_NAME,
        'CATEGORY': poi.CATEGORY,
        'SUB_CAT': poi.SUB_CAT,
        'LANDLINE': poi.LANDLINE,
        'MOBILE': poi.MOBILE,
        'MOBILE_1': poi.MOBILE_1,
        'BUILD_LATE': poi.BUILD_LAT,
        'BUILD_LONE': poi.BUILD_LON,
        'DISPLAY_LATE': poi.DISPLAY_LAT,
        'DISPLAY_LONE': poi.DISPLAY_LON,
        'DATE_COLLECTED': poi.DATE_COLLECTED || '',
        'TIMESTAMP': poi.TIMESTAMP
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    ws['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'POI Data');
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `POI_Data_${date}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    showAlert(`✓ Excel exported! ${poiData.length} POIs saved to ${filename}`, 'success');
    console.log('Excel file exported:', filename);
}

// Show alert
function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Show instructions
function showInstructions() {
    document.getElementById('instructionsModal').style.display = 'flex';
}

// Close instructions
function closeInstructions() {
    document.getElementById('instructionsModal').style.display = 'none';
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('instructionsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('poiForm').dispatchEvent(new Event('submit'));
    }
    // Ctrl+R to reset
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        resetForm();
    }
    // Ctrl+E to export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportToExcel();
    }
});

console.log('✓ POI Collector app.js loaded successfully');
