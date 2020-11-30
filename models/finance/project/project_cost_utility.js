const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectCostModificationRepository = require( '@models/finance/project/project_cost_modification_repository' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const ProjectVO = require( '@models/finance/project/project_vo' );

const { Logger, Account } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectCostUtility {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.userData = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle sum project cost
	* @param {any} projectId
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async handleSumProjectCost( projectId = null, transaction = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'project_id', 'project_line_item_id',
					'vendor_id', 'cost_item_category_id', 'project_purchase_order_id',
					'name', 'unit', 'amount',
					'price', 'bk_amount', 'bk_price',
					'is_extra', 'note', 'description',
					'image', 'created_at', 'updated_at',
					'is_parent', 'parent_id',
					'vo_delete_id', 'vo_add_id',
					[ Sequelize.col( 'add_cost_by.status' ), 'vo_add_status' ],
					[ Sequelize.col( 'delete_cost_by.status' ), 'vo_delete_status' ],
				],
				where: {
					[ Op.or ]: [
						{ is_extra: false },
						{
							is_extra: true,
							bk_amount: { [ Op.ne ]: null },
							bk_price: { [ Op.ne ]: null },
						},
					],
					[ Op.and ]: [{ parent_id : null }],
				},
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
					},
					{
						model: await ProjectPurchaseOrder( this.channelId ),
						attributes: [
							'id', 'vat_percent',
							'discount_type', 'discount_amount',
						],
					},
					{
						model: await ProjectVO( this.channelId ),
						attributes: [ 'id', 'status' ],
						as: 'add_cost_by',
					},
					{
						model: await ProjectVO( this.channelId ),
						attributes: [ 'id', 'status' ],
						as: 'delete_cost_by',
					},
				],
				transaction,
			};

			if ( projectId ) {
				options.include[ 0 ].where = {
					id: _.isArray( projectId ) ? { [ Op.in ]: projectId } : projectId,
				};
			}

			if ( this.account.isPM() ) {
				!options.include[ 0 ].where && ( options.include[ 0 ].where = {} );
				options.include[ 0 ].where.manage_by = this.currentUser.id;
			}
			if ( this.account.isQS() ) {
				!options.include[ 0 ].where && ( options.include[ 0 ].where = {} );
				options.include[ 0 ].where.qs_by = this.currentUser.id;
			}

			const result = await new ProjectCostItemRepository( this.channelId ).getAll( options );
			// let sumtest = 0;
			// result.map(r => {
			// 	sumtest = r.dataValues.amount * r.dataValues.price;
			// });
			let base = 0;
			let modified = 0;
			let hasPO = 0;
			let noPO = 0;
			const po = {};
			let test = 0;
			let baseTest = 0;
			let sub_total_test = 0;
			let vo_total_test = 0;

			// _.map( result, r => {
			// 	const item = r.dataValues;
			// 	if ( item.bk_price !== null ) test = item.bk_amount * item.bk_price;
			// 	else test = item.price * item.amount;
			//
			// 	if ( item.vo_add_id !== null || item.vo_delete_id !== null ) {
			// 		vo_total += item.vo_add_id !== null ? test : -test;
			// 	} else {
			// 		sub_total += test;
			// 	}
			// } );
			_.each( result, item => {
				if ( item.bk_price !== null ) baseTest = item.bk_amount * item.bk_price;
				else baseTest = item.price * item.amount;

				if ( item.vo_add_id !== null || item.vo_delete_id !== null ) {
					// eslint-disable-next-line camelcase
					sub_total_test += item.vo_add_id !== null ? baseTest : -baseTest;
				} else {
					// eslint-disable-next-line camelcase
					vo_total_test += baseTest;
				}
				if (( !_.isNull( item.dataValues.vo_add_status )
						&& item.dataValues.vo_add_status !== CONSTANTS.PROJECT_VO_STATUS.APPROVED )
						|| ( !_.isNull( item.dataValues.vo_delete_status )
							&& item.dataValues.vo_delete_status === CONSTANTS.PROJECT_VO_STATUS.APPROVED )) {
					return;
				}

				base += item.is_extra
					? 0
					: ( +( item.bk_amount || item.amount ) * +( item.bk_price || item.price ) ) || 0;

				const itemModified = item.is_parent
					? 0
					: ( +item.amount * +item.price ) || 0;

				modified += itemModified;

				if ( item.project_purchase_order_id ) {
					const poId = item.project_purchase_order_id;

					if ( !po[ poId ] ) {
						po[ poId ] = {
							id				: poId,
							discount_type	: item.project_purchase_order.discount_type,
							discount_amount	: item.project_purchase_order.discount_amount,
							vat_percent		: item.project_purchase_order.vat_percent || 0,
							total			: 0,
						};
					}

					po[ poId ].total += itemModified;
				} else {
					noPO += itemModified;
				}
			});

			// Check PO discount
			_.each( po, item => {
				const discountMoney = item.discount_type === '%'
					? item.total * item.discount_amount / 100
					: item.discount_amount || 0;
				const poTotal = item.total - discountMoney;

				hasPO += poTotal + ( poTotal * item.vat_percent / 100 );
			} );

			deferred.resolve({
				// base,
				// eslint-disable-next-line camelcase
				base : sub_total_test + vo_total_test,
				modified,
				has_po	: hasPO,
				no_po	: noPO,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle sum project cost
	* @param {any} projectId
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async handleSumEachProjectCost( projectId = null, transaction = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'project_id',
					[ Sequelize.fn( 'sum', Sequelize.literal( 'amount * price' ) ), 'total' ],
				],
				where: { is_parent: false },
				include: {
					model		: await Project( this.channelId ),
					attributes	: [],
				},
				group: [ 'project_id' ],
				transaction,
			};

			if ( projectId ) {
				options.include.where = {
					id: _.isArray( projectId ) ? { [ Op.in ]: projectId } : projectId,
				};
			}

			if ( this.account.isPM() ) {
				!options.include.where && ( options.include.where = {} );
				options.include.where.manage_by = this.currentUser.id;
			}

			if ( this.account.isQS() ) {
				!options.include.where && ( options.include.where = {} );
				options.include.where.qs_by = this.currentUser.id;
			}

			const result = await new ProjectCostItemRepository( this.channelId ).getAll( options );

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle modify
	* @param {object} projectCostItemInput
	* @param {any} transaction - Transaction to commit/rollback
	* @param {boolean} isNewCost - Is new cost item
	* @return {promise}
	*/
	async handleModify( projectCostItemInput, transaction = null, isNewCost = false ) {
		const deferred = Q.defer();

		try {
			const projectCostItemId = projectCostItemInput.id;
			const newVendor = projectCostItemInput.vendor_id;
			const newAmount = projectCostItemInput.amount;
			const newPrice = projectCostItemInput.price;

			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const projectCostItem = await projectCostItemRepository.getOne({
				attributes: [
					'id', 'project_id', 'name',
					'unit', 'vendor_id', 'amount',
					'price', 'is_extra',
					'bk_amount', 'bk_price',
				],
				where: { id: projectCostItemId },
				transaction,
			});

			// Project cost item invalid
			if ( !projectCostItem ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_COST_ITEM_INVALID',
				});
				return deferred.promise;
			}

			if ( newVendor !== projectCostItem.vendor_id ) {
				const updateVendorResult = await projectCostItemRepository.update( { vendor_id: newVendor }, {
					where: { id: projectCostItemId },
					transaction,
				} );

				if ( !updateVendorResult || !updateVendorResult.status ) {
					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PROJECT_COST_VENDOR_FAIL',
					});
					return deferred.promise;
				}
			}

			const projectId = +projectCostItem.project_id;
			const project = await new ProjectRepository( this.channelId ).getOne({
				attributes: [
					'id', 'quotation_status',
					'extra_cost_fee', 'total_extra_fee',
				],
				where: { id: projectId },
				transaction,
			});

			// Project invalid
			if ( !project || project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_INVALID',
				});
				return deferred.promise;
			}

			// Check has modification waiting approve
			const projectCostModificationRepository = new ProjectCostModificationRepository( this.channelId );
			const modificationWaiting = await projectCostModificationRepository.getOne({
				attributes: [ 'id' ],
				where: {
					project_id			: projectId,
					project_cost_item_id: projectCostItemId,
					status				: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
				},
			});

			if ( modificationWaiting ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_COST_MODIFICATION_IS_WAITING',
				});
				return deferred.promise;
			}

			// Check is new cost with cost item extra
			if ( !isNewCost && projectCostItem.is_extra
				&& ( projectCostItem.bk_price === null ) ) {
				isNewCost = true;
			}

			// Check cost modfication
			const newTotal = newAmount * newPrice;
			const currAmount = isNewCost ? 0 : +projectCostItem.amount;
			const currPrice = +projectCostItem.price;

			// Old cost without change amount or price
			if ( !isNewCost && newAmount === currAmount && newPrice === currPrice ) {
				deferred.resolve({
					status	: true,
					message	: 'PROJECT_COST_ITEM_NO_CHANGE',
				});
				return deferred.promise;
			}

			const createData = {
				project_id			: projectId,
				project_cost_item_id: projectCostItemId,
				vendor_id			: projectCostItem.vendor_id,
				name				: projectCostItem.name,
				unit				: projectCostItem.unit,
				old_amount			: currAmount,
				old_price			: currPrice,
				new_amount			: newAmount,
				new_price			: newPrice,
				status				: CONSTANTS.COST_MODIFICATION_STATUS.VALID,
			};
			const baseTotal = ( isNewCost ? 0 : +( projectCostItem.bk_amount || projectCostItem.amount ) )
				* +( projectCostItem.bk_price || projectCostItem.price );
			const maxExtraCostFee = baseTotal * +project.extra_cost_fee / 100;

			// New total over max extra cost fee. Waiting approve
			// New cost need approval
			// isProcurementManager => auto valid
			if ( !this.account.isProcurementManager() && ( isNewCost || newTotal - baseTotal > maxExtraCostFee ) ) {
				createData.status = CONSTANTS.COST_MODIFICATION_STATUS.WAITING;
			} else {
				const sumResult = await new ProjectCostUtility( this.channelId ).handleSumProjectCost( projectId, transaction );
				const maxTotalExtraFee = sumResult.base * +project.total_extra_fee / 100;

				// New total over max total extra fee
				// increase total
				if ( ( baseTotal < newTotal ) && ( sumResult.modified - sumResult.base - baseTotal + newTotal > maxTotalExtraFee ) ) {
					createData.status = CONSTANTS.COST_MODIFICATION_STATUS.WAITING;
				}
			}

			const result = await projectCostModificationRepository.create( createData, { transaction } );

			if ( !result || !result.status ) {
				deferred.resolve({
					status	: false,
					message	: 'CREATE_COST_MODIFICATION_FAIL',
				});
				return deferred.promise;
			}

			// Update new amount, price if status is VALID
			if ( createData.status === CONSTANTS.COST_MODIFICATION_STATUS.VALID ) {
				const updateData = {
					amount	: newAmount,
					price	: newPrice,
				};
				const updateOptions = {
					where: {
						id			: projectCostItemId,
						project_id	: projectId,
					},
					transaction,
				};

				// Backup current amount, price if backup empty for old cost only
				if ( !isNewCost && ( projectCostItem.bk_price === null ) ) {
					updateData.bk_amount = currAmount;
					updateData.bk_price = currPrice;
				}

				const updateResult = await projectCostItemRepository.update( updateData, updateOptions );

				if ( !updateResult || !updateResult.status ) {
					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PROJECT_COST_FAIL',
					});
					return deferred.promise;
				}
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_COST_MODIFICATION_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectCostUtility;
