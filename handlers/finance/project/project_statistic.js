const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const Project = require( '@models/finance/project/project' );
const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
const ProjectBillPlanRepository = require( '@models/finance/project/project_bill_plan_repository' );
const ProjectPaymentRepository = require( '@models/finance/project/project_payment_repository' );
const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );
const ProjectCostUtility = require( '@models/finance/project/project_cost_utility' );
const VOUtility = require( '@models/finance/project/vo_utility' );
const moment = require( 'moment-timezone' );

const { Logger, Account } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectStatisticHandler {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.currentUser = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle get project statistic receivable and receivable plan
	* @param {any} queryOptions
	* @return {promise}
	*/
	async handleGetStatisticRRP( queryOptions = {} ) {
		const deferred = Q.defer();
		const dateNow = moment().format();
		try {
			const projectBillCollectedOptions = {
				where: {
					status		: CONSTANTS.BILL_STATUS.MONEY_COLLECTED,
					[ Op.and ]	: [],
				},
				attributes: [
					[ 'received_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
								+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
								+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
									+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'received_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'received_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'received_date' ],
			};
			projectBillCollectedOptions.where.received_date = {
				[ Op.lte ]: dateNow,
			};


			const projectBillUncollectedOptions = {
				where: {
					status		: { [ Op.ne ]: CONSTANTS.BILL_STATUS.MONEY_COLLECTED },
					[ Op.and ]	: [],
				},
				attributes: [
					[ 'received_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
								+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
								+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
									+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'received_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'received_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'received_date' ],
			};
			const projectPaymentApprovedOptions = {
				where: {
					approve_status	: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
					[ Op.and ]		: [],
				},
				attributes: [
					[ 'invoice_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'project_payment.invoice_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'project_payment.invoice_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'invoice_date' ],
			};
			projectPaymentApprovedOptions.where.invoice_date = {
				[ Op.lte ]: dateNow,
			};

			const projectPaymentUnapprovedOptions = {
				where: {
					approve_status	: { [ Op.ne ]: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED },
					[ Op.and ]		: [],
				},
				attributes: [
					[ 'invoice_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'project_payment.invoice_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'project_payment.invoice_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'invoice_date' ],
			};
			const projectBillPlanOptions = {
				where: {
					[ Op.and ]: [],
				},
				attributes: [
					'target_percent',
					[ 'target_date', 'date' ],
					[ Sequelize.fn( 'year', Sequelize.col( 'target_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'target_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				],
				order: [ 'target_date' ],
			};

			// In case query for overview
			if ( queryOptions.query_for === 'overview' ) {
				projectBillPlanOptions.include[ 0 ].where = { bill_plan_status: CONSTANTS.PLAN_STATUS.APPROVED };
			}

			// In case filter type is week
			if ( queryOptions.type === 'week' ) {
				// Bill collected
				projectBillCollectedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillCollectedOptions.group.push( 'week' );

				// Bill uncollected
				projectBillUncollectedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillUncollectedOptions.group.push( 'week' );

				// Payment approved
				projectPaymentApprovedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentApprovedOptions.group.push( 'week' );

				// Payment unapproved
				projectPaymentUnapprovedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentUnapprovedOptions.group.push( 'week' );

				// Plan
				projectBillPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
			}

			// In case get statistic for one project
			if ( queryOptions.id ) {
				// Bill collected
				projectBillCollectedOptions.where.project_id = queryOptions.id;

				// Bill uncollected
				projectBillUncollectedOptions.where.project_id = queryOptions.id;

				// Payment approved
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						queryOptions.id
					)
				);

				// Payment unapproved
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						queryOptions.id
					)
				);

				// Plan
				projectBillPlanOptions.where.project_id = queryOptions.id;
			}

			// In case current user is PM
			if ( this.account.isPM() ) {
				// Bill collected
				projectBillCollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Bill uncollected
				projectBillUncollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Payment approved
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Payment unapproved
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Plan
				projectBillPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			// In case current user is QS
			if ( this.account.isQS() ) {
				// Bill collected
				projectBillCollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Bill uncollected
				projectBillUncollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Payment approved
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Payment unapproved
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Plan
				projectBillPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
			}

			const result = await Q.all([
				new ProjectBillRepository( this.channelId ).getAll( projectBillCollectedOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentApprovedOptions ),
				new ProjectBillPlanRepository( this.channelId ).getAll( projectBillPlanOptions ),
				new ProjectLineUtility( this.channelId ).handleSumProjectLine( queryOptions.id ),
				new ProjectCostUtility( this.channelId ).handleSumProjectCost( queryOptions.id ),
				new VOUtility( this.channelId ).handleSumQuotation( queryOptions.id ),
				new ProjectBillRepository( this.channelId ).getAll( projectBillUncollectedOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentUnapprovedOptions ),
			]);

			deferred.resolve({
				income				: result[ 0 ],
				cost				: result[ 1 ],
				income_plan			: result[ 2 ],
				total_line			: result[ 3 ],
				total_cost			: result[ 4 ].modified || 0,
				total_cost_has_po	: result[ 4 ].has_po || 0,
				total_cost_no_po	: result[ 4 ].no_po || 0,
				total_vo_quotation	: result[ 5 ].total || 0,
				total_vo_vat		: result[ 5 ].vat || 0,
				income_waiting		: result[ 6 ],
				cost_waiting		: result[ 7 ],
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get dashboard statistic receivable and receivable plan
	* @param {any} queryOptions
	* @return {promise}
	*/
	async handleGetDashboardStatisticRRP( queryOptions = {} ) {
		const deferred = Q.defer();
		const dateNow = moment().format();
		try {
			const projectBillCollectedOptions = {
				where: {
					status		: CONSTANTS.BILL_STATUS.MONEY_COLLECTED,
					[ Op.and ]	: [],
				},
				attributes: [
					[ 'received_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
								+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
								+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
									+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'received_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'received_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							project_status: { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL },
						},
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'received_date' ],
			};

			projectBillCollectedOptions.where.received_date = {
				[ Op.lte ]: dateNow,
			};

			const projectBillUncollectedOptions = {
				where: {
					status		: { [ Op.ne ]: CONSTANTS.BILL_STATUS.MONEY_COLLECTED },
					[ Op.and ]	: [],
				},
				attributes: [
					[ 'received_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
								+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
								+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `status` = '
									+ CONSTANTS.BILL_STATUS.MONEY_COLLECTED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'received_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'received_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							project_status: { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL },
						},
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'received_date' ],
			};
			const projectPaymentApprovedOptions = {
				where: {
					approve_status	: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
					[ Op.and ]		: [],
				},
				attributes: [
					[ 'invoice_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'project_payment.invoice_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'project_payment.invoice_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							project_status: { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL },
						},
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'invoice_date' ],
			};

			projectPaymentApprovedOptions.where.invoice_date = {
				[ Op.lte ]: dateNow,
			};

			const projectPaymentUnapprovedOptions = {
				where: {
					approve_status	: { [ Op.ne ]: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED },
					[ Op.and ]		: [],
				},
				attributes: [
					[ 'invoice_date', 'date' ],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_real` ELSE `total` END' )
						),
						'final_total',
					],
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal(
								'CASE WHEN `approve_status` = '
									+ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED
									+ ' THEN `total_vat_real` ELSE `total_vat` END' )
						),
						'final_total_vat',
					],
					[ Sequelize.fn( 'year', Sequelize.col( 'project_payment.invoice_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'project_payment.invoice_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							project_status: { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL },
						},
					},
				],
				group: [ 'year', 'month' ],
				order: [ 'invoice_date' ],
			};
			const projectBillPlanOptions = {
				where: {
					[ Op.and ]: [],
				},
				attributes: [
					'target_percent', 'project_id',
					[ 'target_date', 'date' ],
					[ Sequelize.fn( 'year', Sequelize.col( 'target_date' ) ), 'year' ],
					[ Sequelize.fn( 'month', Sequelize.col( 'target_date' ) ), 'month' ],
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							project_status: { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL },
						},
					},
				],
				order: [ 'target_date' ],
			};

			// In case filter type is week
			if ( queryOptions.type === 'week' ) {
				// Bill collected
				projectBillCollectedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillCollectedOptions.group.push( 'week' );

				// Bill uncollected
				projectBillUncollectedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillUncollectedOptions.group.push( 'week' );

				// Payment approved
				projectPaymentApprovedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentApprovedOptions.group.push( 'week' );

				// Payment unapproved
				projectPaymentUnapprovedOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentUnapprovedOptions.group.push( 'week' );

				// Plan
				projectBillPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
			}

			queryOptions.ids = queryOptions.ids ? queryOptions.ids.split( ',' ) : [];

			// In case get statistic for multi project
			if ( queryOptions.ids && queryOptions.ids.length ) {
				projectBillCollectedOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
				projectBillUncollectedOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						{ [ Op.in ]: queryOptions.ids }
					)
				);
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						{ [ Op.in ]: queryOptions.ids }
					)
				);

				// Plan
				projectBillPlanOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
			}

			// In case current user is PM
			if ( this.account.isPM() ) {
				// Bill collected
				projectBillCollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Bill uncollected
				projectBillUncollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Payment approved
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Payment unapproved
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);

				// Plan
				projectBillPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			// In case current user is QS
			if ( this.account.isQS() ) {
				// Bill collected
				projectBillCollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Bill uncollected
				projectBillUncollectedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Payment approved
				projectPaymentApprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Payment unapproved
				projectPaymentUnapprovedOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);

				// Plan
				projectBillPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
			}

			const result = await Q.all([
				new ProjectBillRepository( this.channelId ).getAll( projectBillCollectedOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentApprovedOptions ),
				new ProjectBillPlanRepository( this.channelId ).getAll( projectBillPlanOptions ),
				new ProjectLineUtility( this.channelId ).handleSumEachProjectLine( queryOptions.ids ),
				new VOUtility( this.channelId ).handleSumQuotation( queryOptions.id ),
				new ProjectBillRepository( this.channelId ).getAll( projectBillUncollectedOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentUnapprovedOptions ),
			]);

			deferred.resolve({
				income				: result[ 0 ],
				cost				: result[ 1 ],
				income_plan			: result[ 2 ],
				total_line			: result[ 3 ],
				total_vo_quotation	: result[ 4 ].total || 0,
				total_vo_vat		: result[ 4 ].vat || 0,
				income_waiting		: result[ 5 ],
				cost_waiting		: result[ 6 ],
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectStatisticHandler;
