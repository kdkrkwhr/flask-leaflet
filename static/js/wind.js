var lon = 126.9380517322744;
var lat = 37.16792263658907;

function initMap() {
    var worldCanvas = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
        {
            attribution: '김동기, Wind Map 테스트 - 위성 Version'
        });

    var grayCanvas = L.tileLayer("http://{s}.sm.mapstack.stamen.com/(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/{z}/{x}/{y}.png",
        {
            attribution: '김동기, Wind Map 테스트 - 그레이 Version'
        }
    );

    var baseLayers = {
        "위성 Layer": worldCanvas,
        "Gray Layer": grayCanvas
    };
    
    var map = L.map('map', {
        layers: [ grayCanvas ]
    }).setView([lat, lon], 8);

    var layerControl = L.control.layers(baseLayers);
    layerControl.addTo(map);

    return {
        map: map,
        layerControl: layerControl
    };
}

var mapStuff = initMap();
var map = mapStuff.map;
var layerControl = mapStuff.layerControl;

WindJSLeaflet.init({
	localMode: true,
	map: map,
	layerControl: layerControl,
	useNearest: false,
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
