const lat = 37.4830152;
const lon = 126.89008;

mapboxgl.accessToken = "pk.eyJ1Ijoia2ltZG9uZ2tpIiwiYSI6ImNrczVkZ2RzYzFoZDIyeW80MWpwMjd6cjAifQ.VszYvyYJwoacZ6F7X5hCRw";

const map = new mapboxgl.Map({
  style: "mapbox://styles/mapbox/outdoors-v11",
  center: [lon, lat],
  zoom: 19,
  pitch: 60,
  bearing: -80,
  container: "map",
  antialias: true,
  attributionControl: false
});

map.on("load", () => {
  const layers = map.getStyle().layers;
  const labelLayerId = layers.find(
    (layer) => layer.type === "symbol" && layer.layout["text-field"]
  ).id;

  var geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl, 
    zoom: 19,
    placeholder: "주소 검색", 
  });

  map.addControl(geocoder, 'top-left');
  map.addControl(new mapboxgl.NavigationControl());
  map.addLayer(
    {
      id: "add-3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": "#aaa",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15,
          0,
          15.05,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15,
          0,
          15.05,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.6,
      },
    },
    labelLayerId
  );
});
