const fs = require("fs");

class Units {
	constructor() {
		fs.readFile("./units.json", "utf8", (error, data) => {
			if (error) {
				console.log(error);
				return;
			}
			this.units = JSON.parse(data);
		});
	}

	arrayFind(array, value) {
		if (!array || !value) return false;
		for (var i = 0; i < array.length; i++) if (array[i].indexOf(value) != -1) return true;
		return false;
	}

	findAndConvert(string, callback) {
		if (!string || !this.units) return;

		const explode = string.split(" ");
		var parsedWords = [], foundValues = [];

		for (var i = 0; i < explode.length; i++) {
			if (parsedWords.indexOf(i) != -1) continue; // Don't parse if it's already been used for previous word.
			var word = explode[i], nextWord = explode[i+1], value = parseFloat(word);
			if (isNaN(value)) continue;
			word = word.replace(value, ""); // Remove found value, in case if unit was specified with number.
			
			for (const unit of this.units) {
				const isWord1 = this.arrayFind(unit.names, word);
				const isWord2 = nextWord && isNaN(parseFloat(nextWord)) && this.arrayFind(unit.names, nextWord);

				if (!isWord1 && !isWord2) continue;
				if (!isWord1) parsedWords.push(i+1);

				foundValues.push(value * unit.ratio + " " + unit.target);
				break;
			}
		}

		callback(foundValues);
	}
}

module.exports = Units;