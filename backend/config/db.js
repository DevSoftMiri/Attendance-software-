import { Sequelize } from 'sequelize';
import { config } from './env.js';

export const sequelize = new Sequelize(config.databaseUrl, {
    dialect: 'postgres',
    logging: false,
    define: {
        underscored: true,
        freezeTableName: true,
        timestamps: true
    }
});

export async function connectDatabase() {
    await sequelize.authenticate();
    return sequelize;
}
