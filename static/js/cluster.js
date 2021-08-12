var lat = 37.16792;
var lon = 126.93805;
var map, clusterMarkerGroup, markerList, mapCircle;
var geoJsonLayer;

var worldCanvas = L.tileLayer(
  "http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "김동기, 위성 Version",
  }
);
var grayCanvas = L.tileLayer(
  "http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png",
  {
    attribution: "김동기, 그레이 Version",
  }
);
var googleCanvas = L.tileLayer(
  "http://mt.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  {
    attribution: "김동기, Google Layer Version",
  }
);

var myIcon = L.icon({
  iconUrl: "../static/image/marker-blue.png",
  popupAnchor: [10, -7],
});

var randomIcon = L.icon({
  iconUrl: "../static/image/marker-gold.png",
  popupAnchor: [10, -7],
});

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (position) {
        lon = position.coords.longitude;
        lat = position.coords.latitude;
        $("#myLocationTxt").html("내 위치 : " + lat + ", " + lon);
        initMap();
      },
      function (error) {
        $("#myLocationTxt").html("기본 위치 : " + lat + ", " + lon);
        initMap();
        console.error(error);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: Infinity,
      }
    );
  } else {
    $("#myLocationTxt").html("기본 위치 : " + lat + ", " + lon);
    initMap();
    alert("GPS를 지원하지 않습니다 .");
  }
}

function initMap() {
  var baseLayers = {
    "Gray Layer": grayCanvas,
    "위성 Layer": worldCanvas,
    "구글 Layer": googleCanvas,
  };

  map = L.map("map", { layers: [grayCanvas] }).setView([lat, lon], 8);

  var layerControl = L.control.layers(baseLayers);
  layerControl.addTo(map);

  clusterMarkerGroup = L.markerClusterGroup();
  markerList = [];

  populate();
  myMarkerOn();
}

function myMarkerOn() {
  var m = new L.Marker(new L.LatLng(lat, lon), { serial: "dd" });
  var title = "내 위치";
  m.bindPopup(title);
  clusterMarkerGroup.addLayer(m);
  map.addLayer(clusterMarkerGroup);
}

function getRandomLatLng(map) {
  var bounds = map.getBounds(),
    southWest = bounds.getSouthWest(),
    northEast = bounds.getNorthEast(),
    lngSpan = northEast.lng - southWest.lng,
    latSpan = northEast.lat - southWest.lat;

  return new L.LatLng(
    southWest.lat + latSpan * Math.random(),
    southWest.lng + lngSpan * Math.random()
  );
}

function populate() {
  for (var i = 0; i < 1000; i++) {
    var m = new L.Marker(getRandomLatLng(map), { icon: randomIcon });
    var diffDistance = distanceDifferent(m.getLatLng().lng, m.getLatLng().lat);
    var title = i + "번째 데이터<br/>나와의 거리 : " + diffDistance + "km";

    if (mapCircle != undefined) {
      if (!mapCircle.contains(m.getLatLng())) continue;
    }
    m.bindPopup(title);
    markerList.push(m);
    clusterMarkerGroup.addLayer(m);
  }

  map.addLayer(clusterMarkerGroup);
}

function changeCircle() {
  clusterMarkerGroup.clearLayers();
  if (mapCircle != undefined) map.removeLayer(mapCircle);

  var radius = document.getElementById("distanceSelectBox").value;
  if (radius == "all") {
    console.log("all");
    map.removeLayer(mapCircle);
    mapCircle = undefined;
  } else {
    mapCircle = L.circle([lat, lon], Number(radius)).addTo(map);
  }
  L.Circle.include({
    contains: function (latLng) {
      return this.getLatLng().distanceTo(latLng) < this.getRadius();
    },
  });

  populate();
  myMarkerOn();
}

function distanceDifferent(diffLon, diffLat) {
  var R = 6371; // km
  var dLat = ((diffLat - lat) * Math.PI) / 180;
  var dLon = ((diffLon - lon) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((diffLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;

  return Math.round(d * 100) / 100;
}

function onGeoJsonData() {
  if (geoJsonLayer != undefined) {
    console.log("1");
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = undefined;

  } else {
    console.log("2");
    $.getJSON("../static/json/south_korea_sigungu.json", function (json) {
      geoJsonLayer = L.geoJSON(json, {
        onEachFeature: function (feature, layer) {
          layer.bindTooltip(feature.properties.SIG_KOR_NM, { noHide: true });
        },
      }).addTo(map);
    });
  }
}

document.getElementById("moveBtn").onclick = function () {
  var m = markerList[Math.floor(Math.random() * markerList.length)];

  clusterMarkerGroup.zoomToShowLayer(m, function () {
    m.openPopup();
  });
};

document.getElementById("myLocationTxt").onclick = function () {
  map.flyTo([lat, lon], 16, {
    animate: true,
    duration: 1.5,
  });
};

getLocation();

$().ready(function () {});
