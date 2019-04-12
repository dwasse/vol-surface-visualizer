

var optionData = {};
var optionsByName = {};
var minDelta = parseFloat(document.getElementById("minDelta").value);
var maxDelta = parseFloat(document.getElementById("maxDelta").value);
var minStrike = parseFloat(document.getElementById("minStrike").value);
var maxStrike = parseFloat(document.getElementById("maxStrike").value);
var minVol = parseFloat(document.getElementById("minVol").value);
var maxVol = parseFloat(document.getElementById("maxVol").value);
var minDays = parseFloat(document.getElementById("minDays").value);
var maxDays = parseFloat(document.getElementById("maxDays").value);
var callVols = [];
var callDeltas = [];
var callTimes = [];
var callStrikes = [];
var putVols = [];
var putDeltas = [];
var putTimes = [];
var putStrikes = [];
var xAxisName;
var xCallData;
var xPutData;
var callTrace;
var putTrace;
var callLayout;
var putLayout;

var callContainer = document.getElementById("callGraph");
var putContainer = document.getElementById("putGraph");
var callGraph = null;
var putGraph = null;
var callGraphData = null;
var putGraphData = null;

var strikeView = false;
var currentTimestamp = new Date().getTime();

function sendDataPOST(requestData) {
  return new Promise(function(resolve, reject) {
    console.log('sending POST data: ' + JSON.stringify(requestData));
    var data = new FormData();
    for (var key in requestData) {
      data.append(key, requestData[key]);
    }
    var request = new XMLHttpRequest();
    var url = window.location.href;
    request.open('POST', url, true);
    request.responseType = 'text';
    request.onload = async function() {
      var responseData = JSON.parse(request.response);
      console.log(responseData);
      if (responseData['status'] === 'SUCCESS') {
        console.log("Response data success: " + JSON.stringify(responseData));
        resolve(responseData);
      } else {
        reject(responseData);
      }
  };
  request.send(data);
  })
}


async function getOptionData() {
  let requestData = {
    "action": "getOptionData",
    "pair": "BTC/USD"
  }
  let responseData = await sendDataPOST(requestData);
  if (responseData['status'] === 'SUCCESS') {
  	optionData = responseData['data'];
  	console.log("Got option data: " + JSON.stringify(optionData));
  	optionsByName = {};
  	for (var i = 0; i < optionData.length; i++) {
  		option = optionData[i];
  		optionsByName[option['exchange_symbol']] = option;
  	}
  	console.log("Updated optionsByName: " + JSON.stringify(optionsByName));
  	plotVolSurface();
  }
}

function parseOptionData() {
	minDelta = parseFloat(document.getElementById("minDelta").value);
	maxDelta = parseFloat(document.getElementById("maxDelta").value);
	minStrike = parseFloat(document.getElementById("minStrike").value);
	maxStrike = parseFloat(document.getElementById("maxStrike").value);
	minVol = parseFloat(document.getElementById("minVol").value);
	maxVol = parseFloat(document.getElementById("maxVol").value);
	minDays = parseFloat(document.getElementById("minDays").value);
	maxDays = parseFloat(document.getElementById("maxDays").value);
	// console.log("Min delta: " + minDelta + ", max delta: " + maxDelta
	// 	+ ", min strike: " + minStrike + ", max strike: " + maxStrike
	// 	+ ", min vol: " + minVol + ", max vol: " + maxVol
	// 	+ ", min days: " + minDays + ", max days: " + maxDays);
	callTimes = [];
	callDeltas = [];
	callVols = [];
	callStrikes = [];
	putTimes = [];
	putDeltas = [];
	putVols = [];
	putStrikes = [];
	
	for (var key in optionsByName) {
		data = optionsByName[key];
		var expiryParts = data['expiry'].split('-');
		var date = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
		var days = (date.getTime() - currentTimestamp) / (86400 * 1000);
		var delta = parseFloat(data['delta']);
		var vol = parseFloat(data['vol']);
		var strike = parseInt(data['strike']);
		if (vol > minVol && vol < maxVol 
			&& Math.abs(delta) > minDelta 
			&& Math.abs(delta) < maxDelta
			&& strike > minStrike
			&& strike < maxStrike
			&& days > minDays
			&& days < maxDays) {
			if (delta > 0) {
				callTimes.unshift(days);
				callDeltas.unshift(delta);
				callVols.unshift(vol);
				callStrikes.unshift(strike);
			} else if (delta < 0) {
				putTimes.unshift(days);
				putDeltas.unshift(delta);
				putVols.unshift(vol);
				putStrikes.unshift(strike);
			}
		}
		// if (vol > minVol 
		// 	&& vol < maxVol 
		// 	&& Math.abs(delta) > minDelta 
		// 	&& Math.abs(delta) < maxDelta
		// 	&& strike > minStrike
		// 	&& strike < maxStrike
		// 	&& days > minDays
		// 	&& days < maxDays) {
		// 	if (delta > 0) {
		// 		if (!callDeltas.includes(delta)) {
		// 			callDeltas.unshift(delta);
		// 		}
		// 		if (!callTimes.includes(days)) {
		// 			callTimes.unshift(days);
		// 		}
		// 		if (!(delta in callVols)) {
		// 			callVols[delta] = {};
		// 		}
		// 		callVols[delta][days] = vol;
		// 		console.log("Added to call vols with delta: " + delta + ", days: " + days + ", vol: " + vol);
		// 	} else if (delta < 0) {
		// 		if (!putDeltas.includes(delta)) {
		// 			putDeltas.unshift(delta);
		// 		}
		// 		if (!putTimes.includes(days)) {
		// 			putTimes.unshift(days);
		// 		}
		// 		if (!(delta in putVols)) {
		// 			putVols[delta] = {};
		// 		}
		// 		putVols[delta][days] = vol;
		// 		console.log("Added to put vols with delta: " + delta + ", days: " + days + ", vol: " + vol);
		// 	}
		// }
	}
}

function unpack(rows, key) {
  return rows.map(function(row) { return row[key]; });
}

function plotVolSurface(update=false) {
  console.log("Parsing option data");
  parseOptionData();
  console.log("Plotting vol surface");
  var xAxisName;
  var xCallData;
  var xPutData;
  if (strikeView) {
  	xAxisName = "Strike";
  	xCallData = callStrikes;
  	xPutData = putStrikes;
  	console.log("Plotting in strike view");
  } else {
  	xAxisName = "Delta";
  	xCallData = callDeltas;
  	xPutData = putDeltas;
  	console.log("Plotting in delta view");
  }
  callGraphData = new vis.DataSet();
  for (i = 0; i < xCallData.length; i++) {
  	callGraphData.add({
  		x: xCallData[i],
  		y: callTimes[i],
  		z: callVols[i],
  		// style: callVols[i]
  	});
  }
	var options = {
	  width:  '1000px',
	  height: '1000px',
	  style: 'surface',
	  // showPerspective: true,
	  // showGrid: true,
	  // showShadow: false,
	  // keepAspectRatio: true,
	  // verticalRatio: 0.5
	};
  console.log("Call graph data: " + JSON.stringify(callGraphData));
  callGraph = new vis.Graph3d(callContainer, callGraphData, options);
}

function refresh(e) {
	var code = (e.keyCode ? e.keyCode : e.which);
	if (code == 13) {
		console.log("Enter press detected, searching...");
		parseOptionData();
		plotVolSurface(true);
	}
}

function switchViews() {
	var viewSwitch = document.getElementById("viewSwitch");
	if (viewSwitch.checked == true) {
		strikeView = true;
	} else {
		strikeView = false;
	}
	console.log("Switched strikeView: " + strikeView);
	plotVolSurface();
}

function processOptionUpdate(dataString) {
	var data = JSON.parse(dataString);
	optionsByName[data['exchange_symbol']] = data;
	parseOptionData();
	plotVolSurface(true);
	console.log("Processed option update");
}

var socket = null;
var isopen = false;

window.onload = function() {
	socket = new WebSocket("ws://127.0.0.1:9000");
	socket.binaryType = "arraybuffer";

	socket.onopen = function() {
	   console.log("Connected!");
	   isopen = true;
	}

	socket.onmessage = function(e) {
	   if (typeof e.data == "string") {
	      console.log("Received option update: " + e.data);
	      processOptionUpdate(e.data);
	   } else {
	      var arr = new Uint8Array(e.data);
	      var hex = '';
	      for (var i = 0; i < arr.length; i++) {
	         hex += ('00' + arr[i].toString(16)).substr(-2);
	      }
	      console.log("Binary message received: " + hex);
	   }
	}

	socket.onclose = function(e) {
	   console.log("Connection closed.");
	   socket = null;
	   isopen = false;
	}
	};

	function sendText() {
	if (isopen) {
	   socket.send("Hello, world!");
	   console.log("Text message sent.");               
	} else {
	   console.log("Connection not opened.")
	}
	};

	function sendBinary() {
	if (isopen) {
	   var buf = new ArrayBuffer(32);
	   var arr = new Uint8Array(buf);
	   for (i = 0; i < arr.length; ++i) arr[i] = i;
	   socket.send(buf);
	   console.log("Binary message sent.");
	} else {
	   console.log("Connection not opened.")
	}
};


getOptionData();
