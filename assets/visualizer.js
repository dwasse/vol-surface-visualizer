
var websocketIp = "127.0.0.1"
var websocketPort = "9000"
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

reverseNumberSort = function (a, b) {
	return b - a;
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
				callDeltas.unshift(delta);
				callStrikes.unshift(strike);
				callTimes.unshift(days);
				if (!(days in callVols)) {
					callVols[days] = {};
				}
				if (strikeView) {
					callVols[days][strike] = vol;
				} else {
					callVols[days][delta] = vol;
				}
			} else if (delta < 0) {
				console.log("Adding delta for option: " + key + ": " + delta);
				putDeltas.unshift(delta);
				console.log("Adding strike for option: " + key + ": " + strike);
				putStrikes.unshift(strike);
				putTimes.unshift(days);
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
	putDeltas.sort(reverseNumberSort);
	putStrikes.sort(reverseNumberSort);
	putTimes.sort(numberSort);
}

function unpack(rows, key) {
  return rows.map(function(row) { return row[key]; });
}


function getVolByDelta(delta, time) {
	if (delta > 0) {
		var vol = callVols[time][delta];
		if (!vol) {
			if (!callVols[time][delta]) {
				// Get nearest vol
				var deltaArray = Object.keys(callVols[time]);
				var closestDelta = deltaArray.reduce(function(prev, curr) {
				  return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
				});
				vol = callVols[time][closestDelta];
			}
		}
	}
	if (delta < 0) {
		var vol = putVols[time][delta];
		if (!vol) {
			if (!putVols[time][delta]) {
				// Get nearest vol
				var deltaArray = Object.keys(putVols[time]);
				if (deltaArray.length > 0) {
					var closestDelta = deltaArray.reduce(function(prev, curr) {
					  return (Math.abs(curr - delta) < Math.abs(prev - delta) ? curr : prev);
					});
					vol = putVols[time][closestDelta];
				}
			}
		}
	}
	return vol;
}

function getVolByStrike(strike, delta, time) {
	if (delta > 0) {
		var vol = callVols[time][strike];
		if (!vol) {
			if (!callVols[time][strike]) {
				// Get nearest vol
				var strikeArray = Object.keys(callVols[time]);
				var closestStrike = strikeArray.reduce(function(prev, curr) {
				  return (Math.abs(curr - strike) < Math.abs(prev - strike) ? curr : prev);
				});
				vol = callVols[time][closestStrike];
			}
		}
	}
	if (delta < 0) {
		var vol = putVols[time][strike];
		if (!vol) {
			if (!putVols[time][strike]) {
				// Get nearest vol
				var strikeArray = Object.keys(putVols[time]);
				if (strikeArray.length > 0) {
					var closestStrike = strikeArray.reduce(function(prev, curr) {
					  return (Math.abs(curr - strike) < Math.abs(prev - strike) ? curr : prev);
					});
					vol = putVols[time][closestStrike];
				}
			}
		}
	}
	console.log("Got vol with strike " + strike + ", delta " + delta + ", time " + time + ", vol " + vol);
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
	console.log("Num call strikes: " + callStrikes.length + ", num call deltas: " + callDeltas.length);
  for (i = 0; i < callDeltas.length; i++) {
		var delta = callDeltas[i];
		var xData = xCallData[i];
  	for (j = 0; j < callTimes.length; j++) {
			var yData = callTimes[j];
			var zData;
			if (strikeView) {
				zData = getVolByStrike(xData, delta, yData);
			} else {
				zData = getVolByDelta(delta, yData);
			}
	  	callGraphData.add({
	  		x: xData,
	  		y: yData,
	  		z: zData,
	  		style: zData
	  	});
  	}
	}
	var options = {
	  width:  '600px',
	  height: '600px',
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
  for (i = 0; i < putDeltas.length; i++) {
		var delta = putDeltas[i]
  	var xData = xPutData[i];
  	for (j = 0; j < putTimes.length; j++) {
  		var yData = putTimes[j];
			var zData;
			if (strikeView) {
				zData = getVolByStrike(xData, delta, yData);
			} else {
				zData = getVolByDelta(delta, yData);
			}
	  	putGraphData.add({
	  		x: xData,
	  		y: yData,
	  		z: zData,
	  		style: zData
	  	});
  	}
  }
	var options = {
	  width:  '600px',
	  height: '600px',
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
		try {
			callGraph.setData(callGraphData);
		} catch (err) {
			console.log("Error plotting call graph: " + err.message);
		}
		try {
			putGraph.setData(putGraphData);
		} catch (err) {
			console.log("Error plotting put graph: " + err.message);
		}
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
	console.log("Number of options by name before parse: " + Object.keys(optionsByName).length);
	parseOptionData();
	console.log("Number of options by name after parse: " + Object.keys(optionsByName).length);
	plotVolSurface(true);
}

var socket = null;
var isopen = false;

window.onload = function() {
	socket = new WebSocket("ws://" + websocketIp + ":" + websocketPort);
	socket.binaryType = "arraybuffer";

	socket.onopen = function() {
	   console.log("Connected to " + websocketIp + ":" + websocketPort + "!");
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
