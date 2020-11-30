const express = require( 'express' );

const UserRoleRepository = require( '@models/finance/user/user_role_repository' );

const { ApiCache } = require( '@helpers' );
const { validateRoleRequest } = require( '@middlewares' );
const { STATUS_CODE } = require( '@resources' );

const router = express.Router();

router.use( '/', ( req, res, next ) => {
	const channelId = res.locals.channel_id;
	const userData = res.locals.user_data;

	req.UserRoleRepository = new UserRoleRepository( channelId, userData );
	next();
} );

router.get(
	'/list',
	ApiCache.cache(),
	validateRoleRequest( [ 'CEO', 'ADMIN' ] ),
	async ( req, res, next ) => {
		try {
			const result = await req.UserRoleRepository.getAll({
				attributes: [ 'key', 'name' ],
			});

			res.status( STATUS_CODE.OK );
			res.json( result );
		} catch ( error ) {
			next( error );
		}
	}
);

module.exports = router;
