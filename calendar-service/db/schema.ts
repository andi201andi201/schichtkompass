import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const calendars=sqliteTable('calendars',{id:text('id').primaryKey(),readHash:text('read_hash').notNull(),editHash:text('edit_hash').notNull(),updated:integer('updated').notNull()});
export const months=sqliteTable('months',{key:text('key').primaryKey(),calendar:text('calendar').notNull(),month:text('month').notNull(),ics:text('ics').notNull()});
export const limits=sqliteTable('limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
