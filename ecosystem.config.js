const env = process.argv[ process.argv.indexOf( '--env' ) + 1 ];
const isProd = env === 'production';

module.exports = {
	apps: [
		{
			name: isProd ? "Finance-DBPlus-Production" : "Finance-DBPlus-Staging",
			script: "./bin/www",
			instances: isProd ? 8 : "max",
			exec_mode: "cluster",
			env_staging: {
				PORT: 7001,
				NODE_ENV: "staging"
			},
			env_production: {
				PORT: 8001,
				NODE_ENV: "production"
			}
		}
	],
	deploy: {
		staging: {
			user: "ubuntu",
			host: "ec2-52-76-148-140.ap-southeast-1.compute.amazonaws.com",
			key: "~/.ssh/huynguyenSGP.pem",
			ref: "origin/dbplus_staging",
			repo: "git@bitbucket.org:climaxtechnology/financial-be.git",
			path: "/var/www/html/financial-revolve/staging/be",
			"post-deploy": "npm install && pm2 startOrRestart ecosystem.config.js --env staging"
		},
		production: {
			user: "lezo",
			host: "113.161.44.227",
			ref: "origin/dbplus_production",
			repo: "git@bitbucket.org:climaxtechnology/financial-be.git",
			path: "/var/www/html/finance/production/be",
			"post-deploy": "npm install && pm2 startOrRestart ecosystem.config.js --env production"
		}
	}
};
