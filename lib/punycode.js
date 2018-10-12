//----------------------- PUNY CODE ------------------------

TMIN = 1;
TMAX = 26;
BASE = 36;
SKEW = 38;
DAMP = 700; // initial bias scaler
INITIAL_N = 128;
INITIAL_BIAS = 72;

function adapt_bias(delta, n_points, is_first) {
  // scale back, then increase delta
  delta /= is_first ? DAMP : 2;
  delta += ~~(delta / n_points);

  var s = (BASE - TMIN)
  var t = ~~((s * TMAX) / 2) // threshold=455

  for (var k = 0; delta > t; k += BASE) {
    delta = ~~(delta / s);
  }

  var a = (BASE - TMIN + 1) * delta
  var b = (delta + SKEW)

  return k + ~~(a / b)
}

function next_smallest_codepoint(codepoints, n) {
  var m = 0x110000; // unicode upper bound + 1

  for (var i = 0, len = codepoints.length; i < len; ++i) {
    var c = codepoints[i];
    if (c >= n && c < m) {
      m = c;
    }
  }

  // sanity check - should not happen
  if (m >= 0x110000) {
    throw new Error('Next smallest code point not found.');
  }

  return m;
}

function encode_digit(d) {
  return d + (d < 26 ? 97 : 22);
}

function decode_digit(d) {
  if (d >= 48 && d <= 57) {
    return d - 22 // 0..9
  }
  if (d >= 65 && d <= 90) {
    return d - 65 // A..Z
  }
  if (d >= 97 && d <= 122) {
    return d - 97 // a..z
  }
  throw new Error('Illegal digit #' + d)
}

function threshold(k, bias) {
  if (k <= bias + TMIN) {
    return TMIN;
  }
  if (k >= bias + TMAX) {
    return TMAX;
  }
  return k - bias;
}

function encode_int(bias, delta) {
  var result = [];

  for (var k = BASE, q = delta; ; k += BASE) {
    var t = threshold(k, bias);
    if (q < t) {
      result.push(encode_digit(q));
      break;
    }
    else {
      result.push(encode_digit(t + ((q - t) % (BASE - t))));
      q = ~~((q - t) / (BASE - t));
    }
  }

  return result;
}

function puny_encode(input) {
  if (typeof input != 'string') {
    throw new Error('Argument must be a string.');
  }

  input = input.split('').map(function(c) {
    return c.charCodeAt(0);
  });

  var output = [];
  var non_basic = [];

  for (var i = 0, len = input.length; i < len; ++i) {
    var c = input[i];
    if (c < 128) {
      output.push(c);
    }
    else {
      non_basic.push(c);
    }
  }

  var b, h;
  b = h = output.length;

  if (b) {
    output.push(45); // delimiter '-'
  }

  var n = INITIAL_N;
  var bias = INITIAL_BIAS;
  var delta = 0;

  for (var len = input.length; h < len; ++n, ++delta) {
    var m = next_smallest_codepoint(non_basic, n);
    delta += (m - n) * (h + 1);
    n = m;

    for (var i = 0; i < len; ++i) {
      var c = input[i];
      if (c < n) {
        if (++delta == 0) {
          throw new Error('Delta overflow.');
        }
      }
      else if (c == n) {
        // TODO append in-place? i.e. -> output.push.apply(output, encode_int(bias, delta));
        output = output.concat(encode_int(bias, delta));
        bias = adapt_bias(delta, h + 1, b == h);
        delta = 0;
        h++;
      }
    }
  }

  return String.fromCharCode.apply(String, output);
}

function puny_decode(input) {
  if (typeof input != 'string') {
    throw new Error('Argument must be a string.');
  }

  // find basic code points/delta separator
  var b = 1 + input.lastIndexOf('-');

  input = input.split('').map(function(c) {
    return c.charCodeAt(0);
  });

  // start with a copy of the basic code points
  var output = input.slice(0, b ? (b - 1) : 0);

  var n = INITIAL_N;
  var bias = INITIAL_BIAS;

  for (var i = 0, len = input.length; b < len; ++i) {
    var org_i = i;

    for (var k = BASE, w = 1; ; k += BASE) {
      var d = decode_digit(input[b++]);

      // TODO overflow check
      i += d * w;

      var t = threshold(k, bias);
      if (d < t) {
        break;
      }

      // TODO overflow check
      w *= BASE - t;
    }

    var x = 1 + output.length;
    bias = adapt_bias(i - org_i, x, org_i == 0);
    // TODO overflow check
    n += ~~(i / x);
    i %= x;

    output.splice(i, 0, n);
  }

  return String.fromCharCode.apply(String, output);
}

//export
function decode_domain(domain) {
	let arr_name = domain.split('.');
	for (let i=0;i<arr_name.length;i++) {
		try {
			if (arr_name[i].substr(0,4) == 'xn--') arr_name[i] = puny_decode(arr_name[i].substr(4,arr_name[i].length-4));
		} catch(e) {
			//nobody cares
		}
	}
	return arr_name.join('.');
}

