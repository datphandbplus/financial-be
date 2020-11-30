require( 'module-alias/register' );

const express = require( 'express' );
const path = require( 'path' );
const morgan = require( 'morgan' );
const cookieParser = require( 'cookie-parser' );
const bodyParser = require( 'body-parser' );
const cors = require( 'cors' );
const expressValidator = require( 'express-validator' );
const moment = require( 'moment-timezone' );
const compression = require( 'compression' );

const routes = require( '@routes' );
const Bootstrap = require( 'nodejs-core/bootstrap' );

const {
	Factory, CronTask, Model,
	Logger, Validator,
} = require( '@helpers' );
const { validateRequest, validateChannelRequest } = require( '@middlewares' );

const app = express();
const SERVER = Factory.getConfig( 'server' );

// Custom morgan log format
morgan.format( 'dev+', Bootstrap.morganFormat );

app.use( cors({
	origin				: [ SERVER.CLIENT, SERVER.ORIGIN ],
	methods				: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	preflightContinue	: false,
	optionsSuccessStatus: 204,
}) );
app.use( morgan( 'dev+' ) );
app.use( bodyParser.json( { limit: '50mb' } ) );
app.use( bodyParser.urlencoded( { limit: '50mb', extended: false } ) );
app.use( cookieParser() );
app.use( compression() );
app.use( expressValidator({
	customValidators: Validator.customValidators,
	errorFormatter	: Validator.errorFormatter,
}) );
app.use( '/public', express.static( path.join( __dirname, 'public' ) ) );

// Set default moment timezone
moment.tz.setDefault( SERVER.TIMEZONE );

// Backup log folders over 10 days
Logger.backupLogFolders( 10 );

// Generate default channel models
Model.generateDefaultChannelModels();

// Disable limit event listeners
process.setMaxListeners( 0 );

// Run cronjob
CronTask.execDestroyCronTaskIsExpiredTask();
CronTask.execDeleteTempFileTask();

// Middlewares
app.use( '/auth/session/login', [ validateChannelRequest ] );
app.use( '/auth/session/forgot-password', [ validateChannelRequest ] );
app.use( '/api', [ validateChannelRequest, validateRequest ] );

// Authentication Routes
app.use( '/auth/channel', routes.auth.channel );
app.use( '/auth/session', routes.auth.session );
app.use( '/auth/activate', routes.auth.activate );

// User Routes
app.use( '/api/user/account', routes.api.user.account );

// Ext Routes
app.use( '/api/ext/lezo/lezo-employee', routes.api.ext.lezo.lezo_employee );
app.use( '/api/ext/lezo/lezo-project', routes.api.ext.lezo.lezo_project );
app.use( '/api/ext/lezo/lezo-client', routes.api.ext.lezo.lezo_client );

// Finance Routes
// Client
app.use( '/api/finance/client', routes.api.finance.client );

// Vendor
app.use( '/api/finance/vendor-category', routes.api.finance.vendor_category );
app.use( '/api/finance/vendor', routes.api.finance.vendor );

// Line Item
app.use( '/api/finance/line-item-category', routes.api.finance.line_item_category );

// Cost Item
app.use( '/api/finance/cost-item-category', routes.api.finance.cost_item_category );

// Project
app.use( '/api/finance/project', routes.api.finance.project );
app.use( '/api/finance/project-vo', routes.api.finance.project_vo );
app.use( '/api/finance/project-sheet', routes.api.finance.project_sheet );
app.use( '/api/finance/project-bill', routes.api.finance.project_bill );
app.use( '/api/finance/project-bill-plan', routes.api.finance.project_bill_plan );
app.use( '/api/finance/project-payment', routes.api.finance.project_payment );
app.use( '/api/finance/project-payment-plan', routes.api.finance.project_payment_plan );
app.use( '/api/finance/project-line-item', routes.api.finance.project_line_item );
app.use( '/api/finance/project-cost-item', routes.api.finance.project_cost_item );
app.use( '/api/finance/project-purchase-order', routes.api.finance.project_purchase_order );
app.use( '/api/finance/purchase-order-approver', routes.api.finance.purchase_order_approver );
app.use( '/api/finance/project-cost-modification', routes.api.finance.project_cost_modification );
app.use( '/api/finance/project-waiting-action', routes.api.finance.project_waiting_action );

// Receivables
app.use( '/api/finance/receivables', routes.api.finance.receivables );

// Payables
app.use( '/api/finance/payables', routes.api.finance.payables );

// User
app.use( '/api/finance/user', routes.api.finance.user );
app.use( '/api/finance/user/role', routes.api.finance.user_role );

// Setting
app.use( '/api/finance/setting', routes.api.finance.setting );

// Assets handler
app.use( Bootstrap.assetsRouting );

// Catch 404 and forward to error handler
app.use( Bootstrap.catch404Error );

// Error handler
app.use( Bootstrap.catchServerError );

module.exports = app;
