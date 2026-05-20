const SCORE_WEIGHTS = {
  event: 20,
  application: 15,
  appointment: 10,
};

const SCORE_THRESHOLDS = {
  engaged: 67,
  developing: 33,
};

function getRiskLevel(score) {
  if (score >= SCORE_THRESHOLDS.engaged) return 'engaged';
  if (score >= SCORE_THRESHOLDS.developing) return 'developing';
  return 'need outreach';
}

module.exports = { SCORE_WEIGHTS, SCORE_THRESHOLDS, getRiskLevel };
