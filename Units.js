
class Units {
	constructor() {
		this.units = [{
			names: ["inch"],
			target: "cm",
			ratio: 2.54
		}, {
			names: ["foot", "ft"],
			target: "cm",
			ratio: 30.48
		}, {
			names: ["yard", "yd"],
			target: "m",
			ratio: 0.9144
		}, {
			names: ["mile"],
			target: "km",
			ratio: 1.609344
		}];
	}

	findAndConvert(string, callback) {
		if (!string) return;

		const explode = string.split(" ");
		var parsedWords = [], foundValues = [];

		for (var i = 0; i < explode.length; i++) {
			if (parsedWords.indexOf(i) != -1) continue;
			var word = explode[i], nextWord = explode[i+1];
			var value = parseFloat(word);
			if (isNaN(value)) continue;

			word = word.replace(value, "");
			
			for (const unit of this.units) {
				const isWord1 = unit.names.indexOf(word) != -1, isWord2 = nextWord && unit.names.indexOf(nextWord) != -1;
				if (!isWord1 && !isWord2) continue;

				if (isWord1) parsedWords.push(i);
				else parsedWords.push(i+1);

				foundValues.push(value * unit.ratio + " " + unit.target);
				break;
			}
		}

		callback(foundValues);
	}
}

module.exports = Units;