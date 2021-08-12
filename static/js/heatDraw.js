var addressPoints = [];
var lon = 126.9380517322744;
var lat = 37.16792263658907;

var map = L.map('map').setView([lat, lon], 8);

var tiles = L.tileLayer(
    "http://{s}.sm.mapstack.stamen.com/" +
    "(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/" +
    "{z}/{x}/{y}.png", {
        attribution: '김동기, Heat Map 테스트'
    }).addTo(map);

addressPoints = addressPoints.map(function (p) { return [p[0], p[1]]; });

var heat = L.heatLayer(addressPoints).addTo(map), draw = true;

map.on({
    movestart: function () { draw = false; },
    moveend:   function () { draw = true; },
    mousemove: function (e) {
        if (draw) {
            heat.addLatLng(e.latlng);
        }
    }
})