

var optionData = {};
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

var strikeView = false;

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
	console.log("Min delta: " + minDelta + ", max delta: " + maxDelta
		+ ", min strike: " + minStrike + ", max strike: " + maxStrike
		+ ", min vol: " + minVol + ", max vol: " + maxVol
		+ ", min days: " + minDays + ", max days: " + maxDays);
	callTimes = [];
	callDeltas = [];
	callVols = [];
	callStrikes = [];
	putTimes = [];
	putDeltas = [];
	putVols = [];
	putStrikes = [];
	var currentTimestamp = new Date().getTime();
	for (var i = 0; i < optionData.length; i++) {
		data = optionData[i];
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
  var callTrace = {
  	type: 'mesh3d',
  	opacity: 0.5,
    color: 'rgba(255,127,80,0.7)',
  	x: xCallData,
  	y: callTimes,
  	z: callVols,
  }
  var putTrace = {
  	type: 'mesh3d',
  	opacity: 0.5,
    color:'rgb(00,150,200)',
  	x: xPutData,
  	y: putTimes,
  	z: putVols,
  }
  var callLayout = {
    font: {
    	color: '#ffffff'
    },
    paper_bgcolor:"black",
    width: 1000,
    height: 750,
    margin: {
      l: 65,
      r: 50,
      b: 0,
      t: 0,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text: xAxisName,
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var putLayout = {
    font: {
    	color: '#ffffff'
    },
    paper_bgcolor:"black",
    width: 1000,
    height: 750,
    margin: {
      l: 65,
      r: 50,
      b: 0,
      t: 0,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text: xAxisName,
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility',
	    		fontColor: 'white'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var options = {
  	displayModeBar: false
  };
  if (update) {
  	Plotly.react('calls', [callTrace], callLayout, options);
  	Plotly.react('puts', [putTrace], putLayout, options);
  } else {
  	Plotly.newPlot('calls', [callTrace], callLayout, options);
    Plotly.newPlot('puts', [putTrace], putLayout, options);
  }
  console.log("Plotted vol surface");
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


getOptionData();
