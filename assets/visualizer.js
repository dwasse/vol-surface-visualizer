

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
// var callVols = [];
var callVols = {};
var callDeltas = [];
var callTimes = [];
var callStrikes = [];
// var putVols = [];
var putVols = {};
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

numberSort = function (a, b) {
	return a - b;
};

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
	callVols = {};
	callStrikes = [];
	putTimes = [];
	putDeltas = [];
	putVols = {};
	putStrikes = [];
	
	for (var key in optionsByName) {
		data = optionsByName[key];
		var expiryParts = data['expiry'].split('-');
		var date = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
		var days = (date.getTime() - currentTimestamp) / (86400 * 1000);
		var delta = parseFloat(data['delta']);
		var vol = parseFloat(data['vol']);
		var strike = parseInt(data['strike']);
		if (vol > minVol 
			&& vol < maxVol 
			&& Math.abs(delta) > minDelta 
			&& Math.abs(delta) < maxDelta
			&& strike > minStrike
			&& strike < maxStrike
			&& days > minDays
			&& days < maxDays) {
			if (delta > 0) {
				if (!callDeltas.includes(delta)) {
					callDeltas.unshift(delta);
				}
				if (!callStrikes.includes(strike)) {
					callStrikes.unshift(strike);
				}
				if (!callTimes.includes(days)) {
					callTimes.unshift(days);
				}
				if (!(days in callVols)) {
					callVols[days] = {};
				}
				if (strikeView) {
					callVols[days][strike] = vol;
				} else {
					callVols[days][delta] = vol;
				}
			} else if (delta < 0) {
				if (!putDeltas.includes(delta)) {
					putDeltas.unshift(delta);
				}
				if (!putStrikes.includes(strike)) {
					putStrikes.unshift(strike);
				}
				if (!putTimes.includes(days)) {
					putTimes.unshift(days);
				}
				if (!(days in putVols)) {
					putVols[days] = {};
				}
				if (strikeView) {
					putVols[days][strike] = vol;
				} else {
					putVols[days][delta] = vol;
				}
			}
		}
	}
	callDeltas.sort(numberSort);
	callStrikes.sort(numberSort);
	callTimes.sort(numberSort);
	putDeltas.sort(numberSort);
	putStrikes.sort(numberSort);
	putTimes.sort(numberSort);
}

function unpack(rows, key) {
  return rows.map(function(row) { return row[key]; });
}


function getVol(delta, time) {
	console.log("Getting vol with delta " + delta + ", time " + time);
	if (delta > 0) {
		var vol = callVols[time][delta];
		if (!vol) {
			if (!callVols[time][delta]) {
				// Get nearest vols
				var deltaArray = Object.keys(callVols[time]);
				var deltaIndex = null;
				var closestDelta = deltaArray.reduce(function(prev, curr) {
				  return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
				});
				var closestDeltaIndex = deltaArray.indexOf(closestDelta);
				vol = callVols[time][closestDelta];
				// if (closestDeltaIndex > -1) {
				// 	deltaArray.splice(closestDeltaIndex, 1);
				// }
				// var nextClosestDelta = deltaArray.reduce(function(prev, curr) {
				//   return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
				// });
				// console.log("Closest delta: " + closestDelta + ", next closest delta: " + nextClosestDelta);
				// vol = (callVols[time][closestDelta] + callVols[time][nextClosestDelta]) / 2;
				// console.log("Returning interpolated vol: " + vol);
			}
		}
	}
	if (delta < 0) {
		var vol = putVols[time][delta];
		if (!vol) {
			if (!putVols[time][delta]) {
				// Get nearest vols
				var deltaArray = Object.keys(putVols[time]);
				var deltaIndex = null;
				var closestDelta = deltaArray.reduce(function(prev, curr) {
				  return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
				});
				var closestDeltaIndex = deltaArray.indexOf(closestDelta);
				vol = putVols[time][closestDelta];
				// if (closestDeltaIndex > -1) {
				// 	deltaArray.splice(closestDeltaIndex, 1);
				// }
				// var nextClosestDelta = deltaArray.reduce(function(prev, curr) {
				//   return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
				// });
				// console.log("Closest delta: " + closestDelta + ", next closest delta: " + nextClosestDelta);
				// vol = (putVols[time][closestDelta] + putVols[time][nextClosestDelta]) / 2;
				// console.log("Returning interpolated vol: " + vol);
			}
		}
	}
	return vol;
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
  	var xData = xCallData[i];
  	for (j = 0; j < callTimes.length; j++) {
  		var yData = callTimes[j];
	  	var zData = getVol(xData, yData);
	  	callGraphData.add({
	  		x: xData,
	  		y: yData,
	  		z: zData,
	  		style: zData
	  	});
  	}
  }
	var options = {
	  width:  '700px',
	  height: '700px',
	  style: 'surface',
	  showPerspective: true,
	  showGrid: true,
	  showShadow: false,
	  keepAspectRatio: false,
	  verticalRatio: 0.7,
	  xLabel: xAxisName,
	  yLabel: "Days to Expiration",
	  zLabel: "Volatility",
	  zValueLabel: function (z) {return parseInt(z * 100) + '%'}
	};
  putGraphData = new vis.DataSet();
  for (i = 0; i < xPutData.length; i++) {
  	var xData = xPutData[i];
  	for (j = 0; j < putTimes.length; j++) {
  		var yData = putTimes[j];
	  	var zData = getVol(xData, yData);
	  	putGraphData.add({
	  		x: xData,
	  		y: yData,
	  		z: zData,
	  		style: zData
	  	});
  	}
  }
	var options = {
	  width:  '700px',
	  height: '700px',
	  style: 'surface',
	  showPerspective: true,
	  showGrid: true,
	  showShadow: false,
	  keepAspectRatio: false,
	  verticalRatio: 0.7,
	  xLabel: xAxisName,
	  yLabel: "Days to Expiration",
	  zLabel: "Volatility",
	  zValueLabel: function (z) {return parseInt(z * 100) + '%'}
	};
  if (update) {
  	callGraph.setData(callGraphData);
  	putGraph.setData(putGraphData);
  } else {
  	callGraph = new vis.Graph3d(callContainer, callGraphData, options);
  	putGraph = new vis.Graph3d(putContainer, putGraphData, options);
  }
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
