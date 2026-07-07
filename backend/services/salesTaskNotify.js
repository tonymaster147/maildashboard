// Fan-out for sales-task events: bell notifications + emails to the right
// people. Assigned → that person only. General → all sales. Completed →
// Sales Lead(s) + Admin.

const db = require('../config/db');
const { notifyStaff, notifySalesUser } = require('./notifyUser');
const email = require('./emailService');
const { getAdminEmails } = require('./settings');

async function salesEmails(role) {
  const [rows] = await db.query(
    `SELECT email FROM sales_users WHERE status = 'active'${role ? ' AND role = ?' : ''}`,
    role ? [role] : []);
  return rows.map(r => r.email).filter(Boolean);
}
async function activeSales(role) {
  const [rows] = await db.query(
    `SELECT id, email, role FROM sales_users WHERE status = 'active'${role ? ' AND role = ?' : ''}`,
    role ? [role] : []);
  return rows;
}

// Admin assigned a task/reminder to ONE sales person.
async function onTaskAssigned(io, actor, { salesUser, title, dueDate, orderRef, amount, taskId, orderId }) {
  await notifySalesUser(io, salesUser.id, salesUser.role, {
    type: 'sales_task_assigned',
    message: `New task assigned to you: ${title}`,
    referenceId: orderId || taskId || null,
    referenceType: orderId ? 'order' : null,
  }).catch(e => console.error('assign notify failed:', e.message));
  email.sendSalesTaskAssigned({ to: salesUser.email, title, dueDate, orderRef, amount, byName: actor.name })
    .catch(e => console.error('assign email failed:', e.message));
}

// Admin created a GENERAL task for the whole sales team.
async function onGeneralTask(io, actor, { title, dueDate }) {
  await notifyStaff(io, {
    type: 'sales_task_general',
    message: `New team task: ${title}`,
    roles: ['sales_lead', 'sales_executive'],
  }).catch(e => console.error('general notify failed:', e.message));
  const to = await salesEmails();
  email.sendSalesTaskGeneral({ to, title, dueDate, byName: actor.name })
    .catch(e => console.error('general email failed:', e.message));
}

// A sales person completed a task → notify Sales Lead(s) + Admin.
async function onTaskCompleted(io, actor, { title, category, orderRef, orderId }) {
  await notifyStaff(io, {
    type: 'sales_task_done',
    message: `${actor.name || 'A sales person'} completed: ${title}`,
    referenceId: orderId || null,
    referenceType: orderId ? 'order' : null,
    roles: ['admin', 'sales_lead'],
  }).catch(e => console.error('completed notify failed:', e.message));
  const to = [...await getAdminEmails(), ...await salesEmails('sales_lead')];
  email.sendSalesTaskCompleted({ to, title, byName: actor.name, orderRef, category })
    .catch(e => console.error('completed email failed:', e.message));
}

module.exports = { salesEmails, activeSales, onTaskAssigned, onGeneralTask, onTaskCompleted };
