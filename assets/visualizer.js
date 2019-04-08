

var optionData = {};
var minVol = .1;
var maxVol = 2;
var minDelta = .1;
var maxDelta = .5;
var minDaysUntilExpiration = 10;
var call_vols = [];
var call_deltas = [];
var call_times = [];
var put_vols = [];
var put_deltas = [];
var put_times = [];


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
	times = [];
	deltas = [];
	vols = [];
	var currentTimestamp = new Date().getTime();
	for (var i = 0; i < optionData.length; i++) {
		data = optionData[i];
		var expiryParts = data['expiry'].split('-');
		var date = new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2]);
		var daysToExpiration = (date.getTime() - currentTimestamp) / (86400 * 1000);
		var delta = parseFloat(data['delta']);
		var vol = parseFloat(data['vol']);
		console.log("Days to expiration: " + daysToExpiration + ", delta: " + delta + ", vol: " + vol)
		if (vol > minVol && vol < maxVol && Math.abs(delta) > minDelta && Math.abs(delta) < maxDelta && daysToExpiration > minDaysUntilExpiration) {
			if (delta > 0) {
				call_times.unshift(daysToExpiration);
				call_deltas.unshift(delta);
				call_vols.unshift(vol);
			} else if (delta < 0) {
				put_times.unshift(daysToExpiration);
				put_deltas.unshift(delta);
				put_vols.unshift(vol);
			}
		}
	}
	console.log("Updated times: " + JSON.stringify(times));
	console.log("Updated deltas: " + JSON.stringify(deltas));
	console.log("Updated vols: " + JSON.stringify(vols));
}

function unpack(rows, key) {
  return rows.map(function(row) { return row[key]; });
}

function plotVolSurface() {
  console.log("Parsing option data");
  parseOptionData();
  console.log("Plotting vol surface");
  var call_trace = {
  	type: 'mesh3d',
  	intensity: [0, 0.33, 0.66, 1],
    colorscale: [
      [0, 'rgb(255, 0, 0)'],
      [0.5, 'rgb(0, 255, 0)'],
      [1, 'rgb(0, 0, 255)']
    ],
  	x: call_deltas,
  	y: call_times,
  	z: call_vols,
  }
  var put_trace = {
  	type: 'mesh3d',
  	intensity: [0, 0.33, 0.66, 1],
    colorscale: [
      [0, 'rgb(255, 0, 0)'],
      [0.5, 'rgb(0, 255, 0)'],
      [1, 'rgb(0, 0, 255)']
    ],
  	x: put_deltas,
  	y: put_times,
  	z: put_vols,
  }
  var call_layout = {
    title: 'Calls',
    paper_bgcolor:"black",
    autosize: false,
    width: 1000,
    height: 1000,
    margin: {
      l: 65,
      r: 50,
      b: 65,
      t: 90,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text:'Delta'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var put_layout = {
    title: 'Puts',
    paper_bgcolor:"black",
    autosize: false,
    width: 1000,
    height: 1000,
    margin: {
      l: 65,
      r: 50,
      b: 65,
      t: 90,
    },
    scene: {
    	xaxis: {
	    	title: {
	    		text:'Delta'
	    	},
	    	showgrid: true,
	    },
	    yaxis: {
	    	title: {
	    		text: 'Days to Expiration'
	    	},
	    	showgrid: true,
	    },
	    zaxis: {
	    	title: {
	    		text: 'Volatility'
	    	},
	    	showgrid: true,
	    },
    }
  };
  var options = {
  	displayModeBar: false
  };
  Plotly.newPlot('calls', [call_trace], call_layout, options);
  Plotly.newPlot('puts', [put_trace], put_layout, options);
  console.log("Plotted vol surface");
}


getOptionData();
