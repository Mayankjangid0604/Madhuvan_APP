const cron = require('node-cron');
const feeService = require('../services/fee.service');

/**
 * Penalty Job - Applies penalties to overdue fees
 *
 * NOTE: This job runs at 00:10, AFTER feeOverdue.cron.js (00:05) which
 * updates fee statuses (DUE -> OVERDUE). The penalty job depends on
 * statuses being current, so the 5-minute gap ensures correct ordering.
 * Do NOT merge these two jobs -- they serve different purposes:
 *   - feeOverdue.cron.js: updates fee_status based on due_date
 *   - penalty.job.js: applies monetary penalties to already-overdue fees
 */

let isInitialized = false;

const runPenaltyJob = () => {
  try {
    // ✅ Use fee.service.js which has applyPenalties
    const result = feeService.applyPenalties();
    if (result && result.applied > 0) {
      console.log(`✅ Penalty job: ${result.applied} penalties applied`);
    } else {
      console.log('ℹ️ Penalty job: No penalties to apply');
    }
    return result;
  } catch (err) {
    console.error('❌ Penalty job failed:', err.message);
    return { applied: 0, error: err.message };
  }
};

const startPenaltyJob = () => {
  if (isInitialized) {
    console.log('⚠️ Penalty job already initialized');
    return;
  }
  
  isInitialized = true;
  
  // Schedule penalty job to run daily at 00:10
  cron.schedule('10 0 * * *', () => {
    console.log('⏰ Daily penalty job triggered');
    runPenaltyJob();
  });

  console.log('✅ Penalty job initialized (daily at 00:10)');
  
  // Run on startup with delay
  setTimeout(() => {
    console.log('⏰ Running penalty job on startup');
    runPenaltyJob();
  }, 5000);
};

// ✅ Auto-start when required (but with proper initialization)
startPenaltyJob();

module.exports = { 
  startPenaltyJob, 
  runPenaltyJob 
};