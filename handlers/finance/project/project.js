const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );
const moment = require( 'moment-timezone' );

const Client = require( '@models/finance/client/client' );
const CLientRepository = require( '@models/finance/client/client_repository' );
const User = require( '@models/finance/user/user' );
const UserRepository = require( '@models/finance/user/user_repository' );
const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectBill = require( '@models/finance/project/project_bill' );
const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
const ProjectBillPlanRepository = require( '@models/finance/project/project_bill_plan_repository' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectSheetRepository = require( '@models/finance/project/project_sheet_repository' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectPaymentRepository = require( '@models/finance/project/project_payment_repository' );
const ProjectPaymentPlanRepository = require( '@models/finance/project/project_payment_plan_repository' );
const ProjectApprover = require( '@models/finance/project/project_approver' );
const ProjectApproverRepository = require( '@models/finance/project/project_approver_repository' );
const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );
const ProjectCostUtility = require( '@models/finance/project/project_cost_utility' );
const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );
const VOUtility = require( '@models/finance/project/vo_utility' );
const SettingRepository = require( '@models/finance/setting/setting_repository' );

const { Logger, Account, Model } = require( '@helpers' );
const { CONSTANTS, STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectHandler {

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
	* Handle get project
	* @param {int} id - Project id
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetOne( id, queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				where		: { id },
				attributes	: [ 'id' ],
				include		: [],
			};
			const projectRepository = await new ProjectRepository( this.channelId );

			if ( this.account.isPM() ) options.where.manage_by = this.currentUser.id;
			if ( this.account.isSale() ) options.where.sale_by = this.currentUser.id;
			if ( this.account.isQS() ) options.where.qs_by = this.currentUser.id;
			if ( this.account.isPurchasing() ) options.where.purchase_by = this.currentUser.id;
			if ( this.account.isConstruction() ) options.where.construct_by = this.currentUser.id;

			if ( queryOptions && queryOptions.query_for === 'project_info' ) {
				options.attributes = [
					'id', 'name', 'project_code',
					'project_status', 'contact', 'quotation_status',
					'manage_by', 'sale_by', 'construct_by',
					'qs_by', 'purchase_by', 'quotation_note',
					'exchange_rate', 'project_start', 'project_end',
					'valid_duration', 'address', 'quotation_date',
					'bill_plan_status', 'bill_plan_comment', 'payment_plan_status',
					'payment_plan_comment', 'bill_plan_approve_by', 'payment_plan_approve_by',
					'discount_amount', 'discount_type',
				];
				options.include.push(
					{
						model		: await Client( this.channelId ),
						attributes	: [ 'id', 'short_name', 'is_disabled' ],
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'bill_plan_approver',
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'payment_plan_approver',
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'saler',
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'qs',
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'constructor',
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
						as: 'purchaser',
					},
					{
						model: await ProjectApprover( this.channelId ),
						attributes: [
							'id', 'user_id', 'status',
							'comment', 'approved_at',
						],
						include: {
							model		: await User( this.channelId ),
							attributes	: [ 'id', 'full_name' ],
						},
					}
				);

				const result = await projectRepository.getOne( options );

				if ( !result ) {
					deferred.reject({
						status	: STATUS_CODE.PERMISSION_DENIED,
						message	: STATUS_MESSAGE.PERMISSION_DENIED,
					});
					return deferred.promise;
				}

				deferred.resolve( result );
				return deferred.promise;
			}

			if ( queryOptions && queryOptions.query_for === 'project_config' ) {
				options.attributes = [
					'id', 'exchange_rate', 'project_status', 'valid_duration',
					'management_fee', 'total_extra_fee', 'extra_cost_fee',
					'max_po_price', 'discount_amount', 'discount_type',
				];
				options.include.push({
					model	: await ProjectSheet( this.channelId ),
					include	: { model: await ProjectLineItem( this.channelId ) },
				});

				const financeInfo = await new ProjectRepository( this.channelId ).getOne( options );
				const projectCostItems = await new ProjectCostItemRepository( this.channelId ).getAll({
					attributes: [
						'id', 'amount', 'price',
						'bk_amount', 'bk_price',
					],
					where: {
						project_id	: id,
						is_extra	: false,
					},
				});

				financeInfo.dataValues.project_cost_items = projectCostItems;

				const projectVO = await new ProjectVORepository( this.channelId ).getAll({
					where: {
						project_id	: id,
						status		: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
					},
				});

				financeInfo.dataValues.project_vo = projectVO;

				deferred.resolve( financeInfo );
				return deferred.promise;
			}

			options.include.push({
				model	: await ProjectSheet( this.channelId ),
				include	: { model: await ProjectLineItem( this.channelId ) },
			});

			return projectRepository.getOne( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get project statistic
	* @param {any} queryOptions
	* @return {promise}
	*/
	async handleGetStatistic( queryOptions = {} ) {
		const deferred = Q.defer();
		const dateNow = moment().format();
		try {
			const projectBillOptions = {
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
			projectBillOptions.where.received_date = {
				[ Op.lte ]: dateNow,
			};
			const projectPaymentOptions = {
				where: {
					approve_status	: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
					status	: CONSTANTS.PAYMENT_STATUS.PAID,
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
			projectPaymentOptions.where.invoice_date = {
				[ Op.lte ]: dateNow,
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
			const projectPaymentPlanOptions = {
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

			// In case query for dashboard
			if ( queryOptions.query_for === 'dashboard_reference' ) {
				projectBillOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.quotation_status' ),
						CONSTANTS.QUOTATION_STATUS.APPROVED
					)
				);
				projectPaymentOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.quotation_status' ),
						CONSTANTS.QUOTATION_STATUS.APPROVED
					)
				);
			}

			// In case query for overview
			if ( queryOptions.query_for === 'overview' ) {
				projectBillOptions.where.status = CONSTANTS.BILL_STATUS.MONEY_COLLECTED;
				projectPaymentOptions.where.status = CONSTANTS.PAYMENT_STATUS.PAID;

				projectBillPlanOptions.include[ 0 ].where = { bill_plan_status: CONSTANTS.PLAN_STATUS.APPROVED };
				projectPaymentPlanOptions.include[ 0 ].where = { payment_plan_status: CONSTANTS.PLAN_STATUS.APPROVED };
			}

			// In case filter type is week
			if ( queryOptions.type === 'week' ) {
				projectBillOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillOptions.group.push( 'week' );
				projectPaymentOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentOptions.group.push( 'week' );

				// Plan
				projectBillPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
				projectPaymentPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
			}

			// In case get statistic for one project
			if ( queryOptions.id ) {
				projectBillOptions.where.project_id = queryOptions.id;
				projectPaymentOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						queryOptions.id
					)
				);

				// Plan
				projectBillPlanOptions.where.project_id = queryOptions.id;
				projectPaymentPlanOptions.where.project_id = queryOptions.id;
			}

			if ( queryOptions.start && queryOptions.end ) {
				// const startDate = moment( +queryOptions.start );
				// const endDate = moment( +queryOptions.end );

				// projectBillOptions[ Op.and ].da = {
				// 	[ Op.gte ]: startDate.format(),
				// 	[ Op.lte ]: endDate.format(),
				// };

				// projectPaymentOptions[ Op.and ].paid_date = {
				// 	[ Op.gte ]: startDate.format(),
				// 	[ Op.lte ]: endDate.format(),
				// };
			}

			// In case query for overview receivable and receivable plan
			if ( queryOptions.query_for === 'overview_rrp' ) {
				projectBillOptions.where.status = CONSTANTS.BILL_STATUS.MONEY_COLLECTED;
				projectPaymentOptions.where.status = CONSTANTS.PAYMENT_STATUS.PAID;

				projectBillPlanOptions.include[ 0 ].where = { bill_plan_status: CONSTANTS.PLAN_STATUS.APPROVED };
				projectPaymentPlanOptions.include[ 0 ].where = { payment_plan_status: CONSTANTS.PLAN_STATUS.APPROVED };
			}

			// In case current user is PM
			if ( this.account.isPM() ) {
				// Real
				projectBillOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
				projectPaymentOptions.where[ Op.and ].push(
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
				projectPaymentPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			// In case current user is QS
			if ( this.account.isQS() ) {
				// Real
				projectBillOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
				projectPaymentOptions.where[ Op.and ].push(
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
				projectPaymentPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
			}

			const result = await Q.all([
				new ProjectBillRepository( this.channelId ).getAll( projectBillOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentOptions ),
				new ProjectBillPlanRepository( this.channelId ).getAll( projectBillPlanOptions ),
				new ProjectPaymentPlanRepository( this.channelId ).getAll( projectPaymentPlanOptions ),
				new ProjectLineUtility( this.channelId ).handleSumProjectLine( queryOptions.id ),
				new ProjectCostUtility( this.channelId ).handleSumProjectCost( queryOptions.id ),
				new VOUtility( this.channelId ).handleSumQuotation( queryOptions.id ),
			]);

			deferred.resolve({
				income				: result[ 0 ],
				cost				: result[ 1 ],
				income_plan			: result[ 2 ],
				cost_plan			: result[ 3 ],
				total_line			: result[ 4 ],
				total_cost			: result[ 5 ].modified || 0,
				total_cost_has_po	: result[ 5 ].has_po || 0,
				total_cost_no_po	: result[ 5 ].no_po || 0,
				total_vo_quotation	: result[ 6 ].total || 0,
				total_vo_vat		: result[ 6 ].vat || 0,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get project statistic
	* @param {any} queryOptions
	* @return {promise}
	*/
	async handleGetDashboardStatistic( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const dateNow = moment().format();
			const projectBillOptions = {
				where: {
					status		: { [ Op.eq ]: CONSTANTS.BILL_STATUS.MONEY_COLLECTED },
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
			projectBillOptions.where.received_date = {
				[ Op.lte ]: dateNow,
			};
			const projectPaymentOptions = {
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
					// [ Sequelize.fn( 'sum', Sequelize.col( 'project_payment.total' ) ), 'total' ],
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
			projectPaymentOptions.where.invoice_date = {
				[ Op.lte ]: dateNow,
			};
			const projectBillPlanOptions = {
				where: {
					[ Op.and ]: [],
				},
				attributes: [
					[ 'target_date', 'date' ],
					'project_id', 'target_percent',
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
			const projectPaymentPlanOptions = {
				where: {
					[ Op.and ]: [],
				},
				attributes: [
					[ 'target_date', 'date' ],
					'project_id', 'target_percent',
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

			// Query for dashboard
			projectBillOptions.where[ Op.and ].push(
				Sequelize.where(
					Sequelize.col( 'project.quotation_status' ),
					CONSTANTS.QUOTATION_STATUS.APPROVED
				)
			);
			projectPaymentOptions.where[ Op.and ].push(
				Sequelize.where(
					Sequelize.col( 'project.quotation_status' ),
					CONSTANTS.QUOTATION_STATUS.APPROVED
				)
			);

			// In case filter type is week
			if ( queryOptions.type === 'week' ) {
				projectBillOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'received_date' ), 3 ), 'week' ]
				);
				projectBillOptions.group.push( 'week' );
				projectPaymentOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'project_payment.invoice_date' ), 3 ), 'week' ]
				);
				projectPaymentOptions.group.push( 'week' );

				// Plan
				projectBillPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
				projectPaymentPlanOptions.attributes.push(
					[ Sequelize.fn( 'week', Sequelize.col( 'target_date' ), 3 ), 'week' ]
				);
			}

			queryOptions.ids = queryOptions.ids ? queryOptions.ids.split( ',' ) : [];

			// In case get statistic for multi project
			if ( queryOptions.ids && queryOptions.ids.length ) {
				projectBillOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
				projectPaymentOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.id' ),
						{ [ Op.in ]: queryOptions.ids }
					)
				);

				// Plan
				projectBillPlanOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
				projectPaymentPlanOptions.where.project_id = { [ Op.in ]: queryOptions.ids };
			}

			// In case current user is PM
			if ( this.account.isPM() ) {
				// Real
				projectBillOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
				projectPaymentOptions.where[ Op.and ].push(
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
				projectPaymentPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			// In case current user is QS
			if ( this.account.isQS() ) {
				// Real
				projectBillOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
				projectPaymentOptions.where[ Op.and ].push(
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
				projectPaymentPlanOptions.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					)
				);
			}

			// Query start end time
			if ( queryOptions.start && queryOptions.end ) {
				const startDate = moment( +queryOptions.start ).format();
				const endDate = moment( +queryOptions.end ).format();

				projectBillOptions.where[ Op.and ].push({
					[ Op.and ]: [
						{ received_date: { [ Op.gte ]: startDate } },
						{ received_date: { [ Op.lte ]: endDate } },
					],
				});

				projectPaymentOptions.where[ Op.and ].push({
					[ Op.and ]: [
						{ invoice_date: { [ Op.gte ]: startDate } },
						{ invoice_date: { [ Op.lte ]: endDate } },
					],
				});

				projectBillPlanOptions.where[ Op.and ].push({
					[ Op.and ]: [
						{ target_date: { [ Op.gte ]: startDate } },
						{ target_date: { [ Op.lte ]: endDate } },
					],
				});

				projectPaymentPlanOptions.where[ Op.and ].push({
					[ Op.and ]: [
						{ target_date: { [ Op.gte ]: startDate } },
						{ target_date: { [ Op.lte ]: endDate } },
					],
				});
			}
			const result = await Q.all([
				new ProjectBillRepository( this.channelId ).getAll( projectBillOptions ),
				new ProjectPaymentRepository( this.channelId ).getAll( projectPaymentOptions ),
				new ProjectBillPlanRepository( this.channelId ).getAll( projectBillPlanOptions ),
				new ProjectPaymentPlanRepository( this.channelId ).getAll( projectPaymentPlanOptions ),
				new ProjectLineUtility( this.channelId ).handleSumEachProjectLine( queryOptions.ids ),
				new ProjectCostUtility( this.channelId ).handleSumEachProjectCost( queryOptions.ids ),
			]);
			// income = receivables
			// cost = payment
			deferred.resolve({
				income		: result[ 0 ],
				cost		: result[ 1 ],
				income_plan	: result[ 2 ],
				cost_plan	: result[ 3 ],
				total_line	: result[ 4 ],
				total_cost	: result[ 5 ],
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get projects
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				where: {},
				attributes: [
					'id', 'name', 'manage_by',
					'client_id', 'client_name', 'quotation_status',
					'contact', 'quotation_note', 'project_code',
					'project_start', 'project_end', 'quotation_date',
					'sale_by', 'qs_by', 'construct_by',
					'purchase_by', 'valid_duration', 'project_status',
					'address', 'discount_amount', 'discount_type',
				],
				include: [
					{
						model		: await Client( this.channelId ),
						attributes	: [ 'id', 'short_name', 'is_disabled' ],
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
					},
					{
						model		: await ProjectApprover( this.channelId ),
						attributes	: [ 'id', 'user_id', 'status' ],
					},
				],
			};

			if ( this.account.isCEO() || this.account.isCFO() || this.account.isFinance() ) {
				options.include.push(
					{
						model		: await ProjectBill( this.channelId ),
						attributes	: [ 'id', 'total_real', 'total_vat_real' ],
						where		: { status: CONSTANTS.BILL_STATUS.MONEY_COLLECTED },
						required	: false,
					},
					{
						model		: await ProjectSheet( this.channelId ),
						attributes	: [ 'id' ],
						include: {
							model: await ProjectLineItem( this.channelId ),
							attributes: [
								'id',
								[ Sequelize.literal( 'price * amount' ), 'total' ],
							],
						},
					}
				);
			}

			if ( this.account.isPM() ) {
				options.where[ Op.or ] = [{ manage_by: this.currentUser.id }];
				options.include.push(
					{
						model		: await ProjectBill( this.channelId ),
						attributes	: [ 'id', 'total_real', 'total_vat_real' ],
						where		: { status: CONSTANTS.BILL_STATUS.MONEY_COLLECTED },
						required	: false,
					},
					{
						model		: await ProjectSheet( this.channelId ),
						attributes	: [ 'id' ],
						include: {
							model: await ProjectLineItem( this.channelId ),
							attributes: [
								'id',
								[ Sequelize.literal( 'price * amount' ), 'total' ],
							],
						},
					}
				);
			}

			if ( this.account.isSale() ) {
				options.where[ Op.or ] = [{ sale_by: this.currentUser.id }];
				options.include.push(
					{
						model		: await ProjectSheet( this.channelId ),
						attributes	: [ 'id' ],
						include: {
							model: await ProjectLineItem( this.channelId ),
							attributes: [
								'id',
								[ Sequelize.literal( 'price * amount' ), 'total' ],
							],
						},
					}
				);
			}

			if ( this.account.isQS() ) {
				options.where[ Op.or ] = [{ qs_by: this.currentUser.id }];
				options.include.push(
					{
						model		: await ProjectSheet( this.channelId ),
						attributes	: [ 'id' ],
						include: {
							model: await ProjectLineItem( this.channelId ),
							attributes: [
								'id',
								[ Sequelize.literal( 'price * amount' ), 'total' ],
							],
						},
					}
				);
			}

			if ( this.account.isPurchasing() ) options.where[ Op.or ] = [{ purchase_by: this.currentUser.id }];
			if ( this.account.isConstruction() ) options.where[ Op.or ] = [{ construct_by: this.currentUser.id }];

			// In case query for dashboard
			if ( queryOptions.query_for === 'dashboard_reference' ) {
				options.attributes = [ 'id', 'name', 'client_id' ];
				options.where.quotation_status = CONSTANTS.QUOTATION_STATUS.APPROVED;
				options.where.project_status = { [ Op.ne ]: CONSTANTS.PROJECT_STATUS.FAIL };

				// Remove all attributes in user & project bill models
				if ( options.include[ 1 ] ) options.include[ 1 ].attributes = [];
				if ( options.include[ 2 ] ) options.include[ 2 ].attributes = [];
			}

			// Select by range
			if ( queryOptions.start && queryOptions.end ) {
				if ( !options.where[ Op.and ] ) options.where[ Op.and ] = [];

				options.where[ Op.and ].push({
					[ Op.and ]: [
						{ created_at: { [ Op.gte ]: moment( +queryOptions.start ).format() } },
						{ created_at: { [ Op.lte ]: moment( +queryOptions.end ).format() } },
					],
				});
			}

			return new ProjectRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project
	* @param {object} data - Project data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {

			const clientId = data.client_id;
			const client = await this._getClient( clientId );

			if ( !client || !client.id ) {
				deferred.resolve({
					status	: false,
					message	: 'CLIENT_INVALID',
				});
				return deferred.promise;
			}

			// Check Sale, QS, Construct, Purchase
			const userFuncs = [
				this._checkUserIsRole( data.sale_by, 'SALE' ),
				this._checkUserIsRole( data.qs_by, 'QS' ),
				this._checkUserIsRole( data.purchase_by, 'PURCHASING' ),
				this._checkUserIsRole( data.manage_by, 'PM' ),
			];

			if ( data.construct_by ) userFuncs.push( this._checkUserIsRole( data.construct_by, 'CONSTRUCTION' ) );

			const checkResult = await Q.all( userFuncs );

			if ( !checkResult
				|| checkResult.length !== userFuncs.length
				|| _.findWhere( checkResult, { status: false } ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const settings = await new SettingRepository( this.channelId ).getAll({
				attributes: [ 'key', 'value' ],
				where: {
					key: {
						[ Op.in ]: [
							'MANAGEMENT_FEE', 'TOTAL_EXTRA_FEE',
							'EXTRA_COST_FEE', 'MAX_PO_PRICE',
						],
					},
				},
			});
			const managementFee = _.findWhere( settings, { key: 'MANAGEMENT_FEE' } );
			const totalExtraFee = _.findWhere( settings, { key: 'TOTAL_EXTRA_FEE' } );
			const extraCostFee = _.findWhere( settings, { key: 'EXTRA_COST_FEE' } );
			const maxPoPrice = _.findWhere( settings, { key: 'MAX_PO_PRICE' } );

			// Create project
			const transaction = await new Model( this.channelId ).transaction();
			const createData = {
				lezo_project_id		: data.lezo_project_id,
				name				: data.name,
				manage_by			: data.manage_by,
				client_id			: clientId,
				client_name			: client.short_name,
				client_payment_term	: +client.payment_term,
				contact				: data.contact,
				address				: data.address,
				project_start		: data.project_start,
				project_end			: data.project_end,
				quotation_date		: data.quotation_date,
				quotation_note		: data.quotation_note,
				valid_duration		: +data.valid_duration,
				project_status		: data.project_status,
				management_fee		: managementFee ? +managementFee.value : 0,
				total_extra_fee		: totalExtraFee ? +totalExtraFee.value : 0,
				extra_cost_fee		: extraCostFee ? +extraCostFee.value : 0,
				max_po_price		: maxPoPrice ? +maxPoPrice.value : 0,
				sale_by				: this.account.isSale() ? this.currentUser.id : data.sale_by,
				qs_by				: data.qs_by,
				construct_by		: data.construct_by,
				purchase_by			: data.purchase_by,
			};

			const [ project, created ] = await new ProjectRepository( this.channelId ).findOrCreate({
				defaults: createData,
				where: {
					[ Op.or ]: [
						{ name: data.name },
						{
							lezo_project_id: {
								[ Op.ne ]: null,
								[ Op.eq ]: data.lezo_project_id,
							},
						},
					],
				},
				transaction,
			});

			if ( !project || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Project approvers
			const procurementManager = await new UserRepository( this.channelId ).getOne({
				attributes: [ 'id' ],
				where: {
					role_key: 'PROCUREMENT_MANAGER',
					is_disabled: false,
				},
			});

			if ( !procurementManager ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROCUREMENT_MANAGER_NOT_FOUND',
				});
				return deferred.promise;
			}

			const approversResult = await new ProjectApproverRepository( this.channelId ).bulkCreate(
				[
					{ project_id: project.id, user_id: project.manage_by }, // PM
					{ project_id: project.id, user_id: project.sale_by }, // Sale
					{ project_id: project.id, user_id: procurementManager.id }, // Procurement Manager
				],
				{ transaction }
			);

			if ( !approversResult || !approversResult.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREATE_PROJECT_APPROVER_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREATE_PROJECT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project
	* @private
	* @param {int} id - Project id
	* @param {object} data - Project data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );

			let project = await projectRepository.getOne({
				where: {
					id: { [ Op.ne ]: id },
					[ Op.or ]: [
						{ name: data.name },
						{
							lezo_project_id: {
								[ Op.ne ]: null,
								[ Op.eq ]: data.lezo_project_id,
							},
						},
					],
				},
			});

			if ( project ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			const queryOptions = {
				attributes	: [ 'id', 'manage_by', 'sale_by' ],
				where		: { id },
			};

			const validProject = await projectRepository.getOne( queryOptions );

			if ( !validProject ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			queryOptions.where[ Op.or ] = [
				{
					quotation_status: {
						[ Op.in ]: [
							CONSTANTS.PROJECT_STATUS.APPROVED,
							CONSTANTS.PROJECT_STATUS.WAITING_APPROVAL,
						],
					},
				},
			];

			if ( this.account.isSale() ) {
				queryOptions.where[ Op.or ].push(
					{
						sale_by: { [ Op.ne ]: this.currentUser.id },
					}
				);
			}

			project = await projectRepository.getOne( queryOptions );

			if ( project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Check Sale, QS, Construct, Purchase
			const userFuncs = [
				this._checkUserIsRole( data.sale_by, 'SALE' ),
				this._checkUserIsRole( data.qs_by, 'QS' ),
				this._checkUserIsRole( data.purchase_by, 'PURCHASING' ),
				this._checkUserIsRole( data.manage_by, 'PM' ),
			];

			if ( data.construct_by ) userFuncs.push( this._checkUserIsRole( data.construct_by, 'CONSTRUCTION' ) );

			const checkResult = await Q.all( userFuncs );

			if ( !checkResult
				|| checkResult.length !== userFuncs.length
				|| _.findWhere( checkResult, { status: false } ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const clientId = data.client_id;
			const client = await this._getClient( clientId );

			if ( !client || !client.id ) {
				deferred.resolve({
					status	: false,
					message	: 'CLIENT_INVALID',
				});
				return deferred.promise;
			}

			const transaction = await new Model( this.channelId ).transaction();
			const updateData = {
				name				: data.name,
				manage_by			: data.manage_by,
				client_id			: data.client_id,
				client_name			: client.short_name,
				client_payment_term	: +client.payment_term,
				contact				: data.contact,
				address				: data.address,
				project_start		: data.project_start,
				project_end			: data.project_end,
				quotation_date		: data.quotation_date,
				quotation_note		: data.quotation_note,
				valid_duration		: +data.valid_duration,
				sale_by				: this.account.isSale() ? this.currentUser.id : data.sale_by,
				qs_by				: data.qs_by,
				construct_by		: data.construct_by,
				purchase_by			: data.purchase_by,
			};
			const updateOptions = {
				where: {
					id,
					quotation_status: {
						[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
					},
				},
				transaction,
			};

			const result = await projectRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			// Check project approver is change
			const funcs = [];

			if ( validProject.manage_by !== updateData.manage_by ) {
				funcs.push( this._changeProjectApprover( id, validProject.manage_by, updateData.manage_by, transaction ) );
			}

			if ( validProject.sale_by !== updateData.sale_by ) {
				funcs.push( this._changeProjectApprover( id, validProject.sale_by, updateData.sale_by, transaction ) );
			}

			if ( funcs.length ) {
				const approversResult = await Q.all( funcs );

				if ( !approversResult || _.findWhere( approversResult, { status: false } ) ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PROJECT_APPROVER_FAIL',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update quotation status
	* @private
	* @param {int} id - Project id
	* @param {object} data - Project data
	* @return {promise}
	*/
	async handleUpdateQuotationStatus( id, data ) {
		const deferred = Q.defer();

		try {
			const queryOptions = {
				attributes	: [ 'id', 'quotation_status' ],
				where		: { id },
			};

			if ( this.account.isPM() ) queryOptions.where.manage_by = this.currentUser.id;
			if ( this.account.isSale() ) queryOptions.where.sale_by = this.currentUser.id;

			const projectRepository = new ProjectRepository( this.channelId );
			const project = await projectRepository.getOne( queryOptions );

			if ( !project
				|| project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED
				|| ( !this.account.isQS() && project.quotation_status !== CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL )
				|| ( this.account.isQS()
					&& !_.contains( [
						CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
						CONSTANTS.QUOTATION_STATUS.CANCELLED,
					], data.quotation_status ) ) ) { // QS cannot change another status
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const quotationStatus = data.quotation_status;

			// Check sheet before change to WAITING_APPROVAL or APPROVED
			if ( quotationStatus === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
				|| quotationStatus === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
				const sheets = await this._getProjectSheets( id );

				if ( !sheets || !sheets.status ) {
					deferred.resolve( sheets );
					return deferred.promise;
				}
			}

			const transaction = await new Model( this.channelId ).transaction();
			const updateData = { status: quotationStatus };
			const updateOptions = {
				where: {
					project_id	: id,
					user_id		: this.currentUser.id,
				},
				transaction,
			};
			const projectApproverRepository = new ProjectApproverRepository( this.channelId );

			let result;

			if ( this.account.isQS() ) { // QS update Quotation Status
				result = await this._updateProjectQuotationStatus( id, quotationStatus, transaction );

				if ( !result || !result.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve( result );
					return deferred.promise;
				}

				// Reset approvers status when change to WAITING_APPROVAL
				if ( quotationStatus === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL ) {
					delete updateOptions.where.user_id;
					result = await projectApproverRepository.bulkUpdate( updateData, updateOptions );
				}
			} else {
				updateData.comment = data.comment;
				// Update Aprrover Decision
				result = await projectApproverRepository.update( updateData, updateOptions );
			}

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			// Check all approver's decisions when change to APPROVED
			if ( quotationStatus === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
				const approverDecisions = await projectApproverRepository.getAll({
					attributes: [ 'id', 'status' ],
					where: {
						project_id	: id,
						status		: CONSTANTS.QUOTATION_STATUS.APPROVED,
					},
					transaction,
				});

				// All approvers APPROVED -> Change Quotation Status to APPROVED
				if ( approverDecisions && approverDecisions.length === CONSTANTS.TOTAL_PROJECT_APPROVER ) {
					const updateProjectResult = await this
					._updateProjectQuotationStatus( id, CONSTANTS.QUOTATION_STATUS.APPROVED, transaction );

					if ( !updateProjectResult || !updateProjectResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve( updateProjectResult );
						return deferred.promise;
					}
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project config
	* @private
	* @param {int} id - Project id
	* @param {object} data - Project data
	* @return {promise}
	*/
	async handleUpdateProjectConfig( id, data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const project = await projectRepository.getByPk( id );

			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.NOT_FOUND,
					message	: STATUS_MESSAGE.NOT_FOUND,
				});
				return deferred.promise;
			}

			const updateData = {
				exchange_rate	: data.exchange_rate,
				project_status	: data.project_status,
				valid_duration	: data.valid_duration,
				management_fee	: data.management_fee,
				total_extra_fee	: data.total_extra_fee,
				extra_cost_fee	: data.extra_cost_fee,
				max_po_price	: data.max_po_price,
			};
			const updateOptions = {
				where: { id },
			};

			if ( !project.project_code && updateData.project_status === CONSTANTS.PROJECT_STATUS.CONTRACTED ) {
				updateData.project_code = await this._generateProjectCode();
			}

			return projectRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill plan status
	* @param {int} id - Project bill plan id
	* @param {object} data - Project bill plan data
	* @return {promise}
	*/
	async handleUpdateBillPlanStatus( id, data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const options = {
				where: {
					id,
					quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
					bill_plan_status: { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ] },
				},
			};

			if ( this.account.isPM() ) {
				options.where.bill_plan_status = { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED ] };
			}

			const project = await projectRepository.getOne( options );

			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// PM could not set status to APPROVED or REJECTED
			if ( this.account.isPM()
				&& _.contains( [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ], data.bill_plan_status ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const updateData = {
				bill_plan_status	: data.bill_plan_status,
				bill_plan_comment	: data.bill_plan_comment,
			};

			if ( _.contains( [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ], data.bill_plan_status ) ) {
				updateData.bill_plan_approve_by = this.currentUser.id;
			} else {
				updateData.bill_plan_approve_by = null;
			}

			return projectRepository.update( updateData, { where: { id } } );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project payment plan status
	* @param {int} id - Project payment plan id
	* @param {object} data - Project payment plan data
	* @return {promise}
	*/
	async handleUpdatePaymentPlanStatus( id, data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const options = {
				where: {
					id,
					quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
					payment_plan_status: { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ] },
				},
			};

			if ( this.account.isPM() ) {
				options.where.payment_plan_status = { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED ] };
			}

			const project = await projectRepository.getOne( options );

			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// PM could not set status to APPROVED or REJECTED
			if ( this.account.isPM()
				&& _.contains( [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ], data.payment_plan_status ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const updateData = {
				payment_plan_status	: data.payment_plan_status,
				payment_plan_comment: data.payment_plan_comment,
			};

			if ( _.contains( [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.REJECTED ], data.payment_plan_status ) ) {
				updateData.payment_plan_approve_by = this.currentUser.id;
			} else {
				updateData.payment_plan_approve_by = null;
			}

			return projectRepository.update( updateData, { where: { id } } );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle soft delete project
	* @param {int} id - Project id
	* @return {promise}
	*/
	async handleSoftDelete( id ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const queryOptions = {
				attributes: [ 'id' ],
				where: {
					id,
					quotation_status: {
						[ Op.in ]: [
							CONSTANTS.QUOTATION_STATUS.APPROVED,
							CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
						],
					},
				},
			};

			if ( this.account.isPM() ) queryOptions.where.manage_by = this.currentUser.id;

			const project = await projectRepository.getOne( queryOptions );

			if ( project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Soft delete project
			const deleteOptions = {
				where: { id },
			};
			const result = await projectRepository.delete( deleteOptions );

			if ( !result || !result.status ) {
				deferred.resolve({
					status	: false,
					message	: 'DELETE_PROJECT_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DELETE_PROJECT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project quotatiion discount
	* @param {int} id - Project payment plan id
	* @param {object} data - Project payment plan data
	* @return {promise}
	*/
	async handleUpdateQuotationDiscount( id, data ) {
		const deferred = Q.defer();

		try {
			const queryOptions = {
				attributes: [ 'id', 'sale_by', 'quotation_status' ],
				where: {
					id,
					quotation_status: {
						[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
					},
				},
			};

			if ( this.account.isSale() ) {
				queryOptions.where[ Op.or ].push(
					{
						sale_by: { [ Op.ne ]: this.currentUser.id },
					}
				);
			}

			const projectRepository = new ProjectRepository( this.channelId );
			const project = await projectRepository.getOne( queryOptions );

			if ( !project ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_INVALID',
				});
				return deferred.promise;
			}

			const totalLine = await new ProjectLineUtility( this.channelId ).handleSumProjectLine( id );
			const updateData = {
				discount_amount	: +data.discount_amount,
				discount_type	: data.discount_type,
			};
			const updateOptions = {
				where: {
					id,
					quotation_status: {
						[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
					},
				},
			};
			const discountValue = updateData.discount_type === '$'
				? updateData.discount_amount
				: totalLine * updateData.discount_amount / 100;

			if ( totalLine - discountValue < 0 ) {
				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			return projectRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get user manage
	* @private
	* @param {int} ids - User ids
	* @return {promise}
	*/
	_getUserManagers( ids ) {
		return new UserRepository( this.channelId ).getAll({
			where: {
				id			: { [ Op.in ]: ids },
				is_disabled	: false,
			},
			attributes: [ 'id' ],
		});
	}

	/**
	* Handle get client
	* @private
	* @param {int} id - Client id
	* @return {promise}
	*/
	_getClient( id ) {
		return new CLientRepository( this.channelId ).getOne({
			attributes	: [ 'id', 'short_name', 'payment_term' ],
			where		: { id, is_disabled: false },
		});
	}

	/**
	* Handle get project sheets
	* @private
	* @param {int} id - Project id
	* @return {promise}
	*/
	async _getProjectSheets( id ) {
		const deferred = Q.defer();

		try {
			const sheets = await new ProjectSheetRepository( this.channelId ).getAll({
				attributes	: [ 'id' ],
				where		: { project_id: id },
			});

			if ( !sheets || !sheets.length ) {
				deferred.resolve({
					status	: false,
					message	: 'SHEET_INVALID',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_SHEET_IS_VALID',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Generate project code
	* @private
	* @return {string}
	*/
	async _generateProjectCode() {
		const deferred = Q.defer();

		try {
			const count = await new ProjectRepository( this.channelId ).getOne({
				attributes: [[ Sequelize.fn( 'count', Sequelize.col( 'project_code' ) ), 'count_project' ]],
				where: {
					project_code: {
						[ Op.like ]: 'E' + moment().format( 'YY' ) + '%',
					},
				},
			});

			deferred.resolve(
				'E' + moment().format( 'YY' )
					+ ( ++count.dataValues.count_project ).toString().padStart( 3, '0' )
			);
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Update project quotation status
	* @private
	* @param {int} id - Project id
	* @param {int} status - Quotation status
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	_updateProjectQuotationStatus( id, status, transaction = null ) {
		return new ProjectRepository( this.channelId ).update(
			{ quotation_status: status },
			{
				where: {
					id,
					quotation_status: { [ Op.ne ]: CONSTANTS.QUOTATION_STATUS.APPROVED },
				},
				transaction,
			}
		);
	}

	/**
	* Check user is role
	* @private
	* @param {int} id - User id
	* @param {string} role - User role
	* @return {promise}
	*/
	async _checkUserIsRole( id, role ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( this.channelId ).getOne({
				attributes: [ 'id' ],
				where: {
					id,
					role_key	: role,
					is_disabled	: false,
				},
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_ROLE_INVALID',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'USER_ROLE_VALID',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Change project approver
	* @private
	* @param {int} projectId - Project id
	* @param {int} oldUserId - Old User id
	* @param {int} userId - User id
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	_changeProjectApprover(
		projectId, oldUserId,
		userId, transaction = null
	) {
		const deferred = Q.defer();

		try {
			return new ProjectApproverRepository( this.channelId ).update(
				{
					user_id	: userId,
					status	: CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
				},
				{
					where: {
						project_id	: projectId,
						user_id		: oldUserId,
					},
					transaction,
				}
			);
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectHandler;
