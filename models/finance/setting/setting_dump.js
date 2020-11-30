const Q = require( 'q' );

const Dump = require( '@models/dump' );

module.exports = model => {
	return Q.all([
		Dump(
			model,
			{ key: 'MANAGEMENT_FEE', value: 10 },
			{ key: 'MANAGEMENT_FEE' }
		),
		Dump(
			model,
			{ key: 'TOTAL_EXTRA_FEE', value: 2 },
			{ key: 'TOTAL_EXTRA_FEE' }
		),
		Dump(
			model,
			{ key: 'EXTRA_COST_FEE', value: 10 },
			{ key: 'EXTRA_COST_FEE' }
		),
		Dump(
			model,
			{ key: 'MAX_PO_PRICE', value: 1000000000 },
			{ key: 'MAX_PO_PRICE' }
		),
	]);
};
