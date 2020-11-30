const Q = require( 'q' );

const Dump = require( '@models/dump' );

module.exports = model => {
	return Q.all([
		Dump(
			model,
			{
				key	: 'ADMIN',
				name: 'Admin',
			},
			{ key: 'ADMIN' }
		),
		Dump(
			model,
			{
				key	: 'CEO',
				name: 'CEO',
			},
			{ key: 'CEO' }
		),
		Dump(
			model,
			{
				key	: 'CFO',
				name: 'CFO',
			},
			{ key: 'CFO' }
		),
		Dump(
			model,
			{
				key	: 'GENERAL_ACCOUNTANT',
				name: 'General Accountant',
			},
			{ key: 'GENERAL_ACCOUNTANT' }
		),
		Dump(
			model,
			{
				key	: 'LIABILITIES_ACCOUNTANT',
				name: 'Liabilities Accountant',
			},
			{ key: 'LIABILITIES_ACCOUNTANT' }
		),
		Dump(
			model,
			{
				key	: 'PM',
				name: 'PM',
			},
			{ key: 'PM' }
		),
		Dump(
			model,
			{
				key	: 'SALE',
				name: 'Sale',
			},
			{ key: 'SALE' }
		),
		Dump(
			model,
			{
				key	: 'PROCUREMENT_MANAGER',
				name: 'Procurement Manager',
			},
			{ key: 'PROCUREMENT_MANAGER' }
		),
		Dump(
			model,
			{
				key	: 'QS',
				name: 'QS',
			},
			{ key: 'QS' }
		),
		Dump(
			model,
			{
				key	: 'PURCHASING',
				name: 'Purchasing',
			},
			{ key: 'PURCHASING' }
		),
		Dump(
			model,
			{
				key	: 'CONSTRUCTION_MANAGER',
				name: 'Construction Manager',
			},
			{ key: 'CONSTRUCTION_MANAGER' }
		),
		Dump(
			model,
			{
				key	: 'CONSTRUCTION',
				name: 'Construction',
			},
			{ key: 'CONSTRUCTION' }
		),
	]);
};
