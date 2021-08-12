var lat = 37.16792;
var lon = 126.93805;
var map, clusterMarkerGroup, CCTVMarkerGroup, markerList, mapCircle;
var geoJsonLayer, layerControl;
var CCTVData, CCTVFlag = true;

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
var stadiaCanvas = L.tileLayer(
  "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=8f890138-c2ce-4e19-a081-ec6b9154f34",
  {
    attribution: "김동기, Stadia Dark Tile Version",
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

var CCTVIcon = L.icon({
  iconUrl: "../static/image/marker-cctv.png",
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

function drawWindDataOnLeaflet() {}

function initMap() {
  var baseLayers = {
    "Gray Layer": grayCanvas,
    "위성 Layer": worldCanvas,
    "구글 Layer": googleCanvas,
    "Stadia Layer": stadiaCanvas,
  };

  map = L.map("map", { layers: [grayCanvas] }).setView([lat, lon], 8);

  layerControl = L.control.layers(baseLayers);
  layerControl.addTo(map);
  var windLeaf = WindJSLeaflet;
  windLeaf.init({
    localMode: true,
    map: map,
    layerControl: layerControl,
    useNearest: true,
    timeISO: null,
    nearestDaysLimit: 7,
    displayValues: true,
    displayOptions: {
      displayPosition: 'bottomleft',
      displayEmptyString: 'No wind data'
    },
    overlayName: '바람 표출',
    errorCallback:  function(err){
          console.log("ERROR ", err);
      }
  });

  clusterMarkerGroup = L.markerClusterGroup();
  CCTVMarkerGroup = L.markerClusterGroup();
  markerList = [];
  CCTVMarkerList = [];
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

function changeCircle() {
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
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = undefined;

  } else {
    $.getJSON("../static/json/south_korea_sigungu.json", function (json) {
      geoJsonLayer = L.geoJSON(json, {
        onEachFeature: function (feature, layer) {
          layer.bindTooltip(feature.properties.SIG_KOR_NM, { noHide: true });
        },
      }).addTo(map);
    });
  }
}

function onCCTVData() {
  CCTVMarkerGroup.clearLayers();

  if (CCTVFlag == false) {
    CCTVFlag = true;
    return;

  } else {
    CCTVFlag = false;
  }

  for (let index in CCTVData) {
    if (CCTVData[index].lat == "" || CCTVData[index].lon == "") continue;
    let m = new L.Marker(new L.LatLng(
      CCTVData[index].lat,
      CCTVData[index].lon
    ), { icon: CCTVIcon });

    let diffDistance = distanceDifferent(m.getLatLng().lng, m.getLatLng().lat);
    let title = "<strong>[CCTV] " + CCTVData[index].address +
      "</strong><hr/>나와의 거리 : " + diffDistance + "km<br/>관리 : " + CCTVData[index].management + "<br/>방면 : " + CCTVData[index].view_direct + 
      "<br/>대(수) : " + CCTVData[index].count;

    m.bindPopup(title);
    CCTVMarkerGroup.addLayer(m);
  }

  map.addLayer(CCTVMarkerGroup);
}

function myLocationZoom() {
  map.flyTo([lat, lon], 16, {
    animate: true,
    duration: 1.5,
  });
};

function viewMarkerType(type) {
  $(".marker-content-view div").css("opacity", "0.3");
  $("#" + type + "ContentViewDiv").css("opacity", "1.0");
}

getLocation();

$().ready(function () {
  $.getJSON("../static/json/south_korea_cctv.json", function (json) {
    CCTVData = json;
  });
});
