mapboxgl.accessToken = 'pk.eyJ1IjoiZ2F1cmF2bmciLCJhIjoiY20xdG1kZTA0MDNiejJ2c2JtMmRlaG02OSJ9._xGChZrx9OZlwpcv3dXVqQ';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [77.2090, 28.6139], 
    zoom: 12 ,
});
let isSatelliteView = false; // Track whether satellite view is active

document.getElementById('toggle-style').addEventListener('click', function() {
    if (isSatelliteView) {
        // Switch back to streets view
        map.setStyle('mapbox://styles/mapbox/streets-v12');
        this.innerText = 'Satellite View'; // Update button text
    } else {
        // Switch to satellite view
        map.setStyle('mapbox://styles/mapbox/satellite-v9');
        this.innerText = 'Streets View'; // Update button text
    }
    isSatelliteView = !isSatelliteView; // Toggle the view state
});


// Add zoom and rotation controls to the map
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

// Function to toggle the traffic layer
let trafficLayerVisible = false;

function toggleTraffic() {
    if (trafficLayerVisible) {
        map.removeLayer('traffic');
        map.removeSource('traffic');
    } else {
        map.addSource('traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
        
        map.addLayer({
            'id': 'traffic',
            'type': 'line',
            'source': 'traffic',
            'source-layer': 'traffic',
            'layout': {},
            'paint': {
                'line-color': 'rgba(255, 0, 0, 0.7)',
                'line-width': 2
            }
        });
    }
    trafficLayerVisible = !trafficLayerVisible;
}

// Event listener for the traffic toggle checkbox
document.getElementById('toggle-traffic').addEventListener('change', function() {
    toggleTraffic();
});

// Initialize the Geocoder (search box)
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false,
    placeholder: 'Search for places',
    bbox: [-180, -90, 180, 90],
    proximity: {
        longitude: 77.2090,
        latitude: 28.6139
    }
});

// Add the geocoder to the map
map.addControl(geocoder, 'top-left');

// Add Geolocate control to the map
map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserHeading: true
}));

// Function to add a marker
function addMarker(coordinates, description, color = 'blue', className = '') {
    new mapboxgl.Marker({ color, className })
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(description))
        .addTo(map);
}

// Handle geocoder result
geocoder.on('result', (e) => {
    const coords = e.result.center;
    removeMainMarkers();
    addMarker(coords, e.result.place_name);
    fetchNearbyPlaces(coords);
    displayCustomRecommendations(coords);
});

// Function to remove main markers (start and end)
function removeMainMarkers() {
    const existingMainMarkers = document.getElementsByClassName('main-marker');
    while(existingMainMarkers[0]) {
        existingMainMarkers[0].parentNode.removeChild(existingMainMarkers[0]);
    }
}

// Function to fetch nearby places using Mapbox Geocoding API
function fetchNearbyPlaces(center) {
    const types = ['restaurant', 'park', 'hotel'];
    const promises = types.map(type => {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(type)}.json?proximity=${center[0]},${center[1]}&limit=10&access_token=${mapboxgl.accessToken}`;
        return fetch(url).then(response => response.json());
    });

    Promise.all(promises)
        .then(results => {
            removeNearbyMarkers();
            const nearbyPlacesDiv = document.getElementById('nearby-places');
            nearbyPlacesDiv.innerHTML = '<ul></ul>';

            results.forEach((data, index) => {
                const type = types[index];
                data.features.forEach(feature => {
                    if(feature.geometry && feature.geometry.coordinates){
                        let color;
                        switch(type){
                            case 'restaurant':
                                color = 'red';
                                break;
                            case 'park':
                                color = 'green';
                                break;
                            case 'hotel':
                                color = 'orange';
                                break;
                            default:
                                color = 'blue';
                        }
                        addMarker(feature.geometry.coordinates, feature.place_name, color, 'nearby-marker');
                        const ul = nearbyPlacesDiv.querySelector('ul');
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${capitalizeFirstLetter(type)}:</strong> ${feature.text}`;
                        ul.appendChild(li);
                    }
                });
            });
        })
        .catch(error => console.error('Error fetching nearby places:', error));
}

// Function to remove nearby place markers
function removeNearbyMarkers() {
    const existingMarkers = document.getElementsByClassName('nearby-marker');
    while(existingMarkers[0]) {
        existingMarkers[0].parentNode.removeChild(existingMarkers[0]);
    }
}

// Function to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Initialize Geocoders for start and end locations
const startGeocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Start Location',
    marker: false
});

const endGeocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'End Location',
    marker: false
});

// Attach geocoders to input fields
document.getElementById('start').appendChild(startGeocoder.onAdd(map));
document.getElementById('end').appendChild(endGeocoder.onAdd(map));

// Variables to store coordinates
let startCoords = null;
let endCoords = null;

// Listen for results from start geocoder
startGeocoder.on('result', (e) => {
    startCoords = e.result.center;
    addMarker(startCoords, 'Start Location', 'green', 'main-marker');
});

// Listen for results from end geocoder
endGeocoder.on('result', (e) => {
    endCoords = e.result.center;
    addMarker(endCoords, 'End Location', 'red', 'main-marker');
});

// Handle distance calculation
document.getElementById('calculate').addEventListener('click', () => {
    if(startCoords && endCoords){
        const from = turf.point(startCoords);
        const to = turf.point(endCoords);
        const options = { units: 'kilometers' };
        const distance = turf.distance(from, to, options);

        document.getElementById('distance').innerText = `Distance: ${distance.toFixed(2)} km`;
        drawLine(startCoords, endCoords);
    } else {
        alert('Please select both start and end locations.');
    }
});

// Function to draw a line between two points
function drawLine(start, end){
    if(map.getLayer('route')){
        map.removeLayer('route');
    }
    if(map.getSource('route')){
        map.removeSource('route');
    }

    const route = {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [start, end]
        }
    };

    map.addSource('route', {
        'type': 'geojson',
        'data': route
    });

    map.addLayer({
        'id': 'route',
        'type': 'line',
        'source': 'route',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#888',
            'line-width': 6
        }
    });
}

// Handle route suggestions
document.getElementById('get-route').addEventListener('click', () => {
    if(startCoords && endCoords){
        const mode = document.getElementById('transport-mode').value;
        getRoute(startCoords, endCoords, mode);
    } else {
        alert('Please select both start and end locations.');
    }
});

// Function to get route from Mapbox Directions API
function getRoute(start, end, mode){
    const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const route = data.routes[0].geometry.coordinates;
            drawRoute(route);
        })
        .catch(error => console.error('Error fetching route:', error));
}

// Function to draw the route
function drawRoute(route) {
    if(map.getLayer('route')){
        map.removeLayer('route');
    }
    if(map.getSource('route')){
        map.removeSource('route');
    }

    map.addSource('route', {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': route
            }
        }
    });

    map.addLayer({
        'id': 'route',
        'type': 'line',
        'source': 'route',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#007cbf',
            'line-width': 4
        }
    });
}

// Function to display custom recommendations
function displayCustomRecommendations(coords) {
    const recommendationsDiv = document.getElementById('custom-recommendations');
    recommendationsDiv.innerHTML = ''; // Clear previous recommendations

    // Dummy recommendations for demonstration
    const recommendations = [
        { title: 'Local Park', description: 'A great place for a walk.', coordinates: [77.2170, 28.6171] },
        { title: 'Nearby Restaurant', description: 'Enjoy delicious food here.', coordinates: [77.2120, 28.6110] },
    ];

    recommendations.forEach(rec => {
        const recItem = document.createElement('div');
        recItem.innerHTML = `<strong>${rec.title}</strong>: ${rec.description}`;
        recommendationsDiv.appendChild(recItem);
    });
}
