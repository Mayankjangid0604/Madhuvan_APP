const cron = require("node-cron");
const feeService = require("../services/fee.service");

/**
 * Runs every day at 00:05 AM - flips DUE fees to OVERDUE once due_date has passed
 * (and recomputes DUE/PARTIAL/PAID as a safety net).
 *
 * NOTE: Must run BEFORE penalty.job.js (00:10) which applies monetary penalties
 * to fees already marked OVERDUE by this job. Do not merge these two jobs.
 */
const startFeeOverdueCron = () => {
  cron.schedule("5 0 * * *", () => {
    console.log("⏳ Running fee overdue cron (scheduled)...");
    try {
      const result = feeService.updateAllFeeStatuses();
      console.log(`✅ Fee statuses updated: ${result.updated}/${result.checked}`);
    } catch (err) {
      console.error("❌ Fee overdue cron failed:", err.message);
    }
  });

  console.log("⏰ Fee overdue cron job started");

  // Run immediately on startup
  try {
    feeService.updateAllFeeStatuses();
  } catch (err) {
    console.error("❌ Initial fee status update failed:", err.message);
  }
};

module.exports = { startFeeOverdueCron };
