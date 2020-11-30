const { Account } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const validateRoleRequest = roles => ( req, res, next ) => {
	const account = new Account( res.locals.user_data );

	if ( !account.hasRoles( roles ) ) {
		next({
			status	: STATUS_CODE.PERMISSION_DENIED,
			message	: STATUS_MESSAGE.PERMISSION_DENIED,
		});
		return;
	}

	next();
};

module.exports = validateRoleRequest;
