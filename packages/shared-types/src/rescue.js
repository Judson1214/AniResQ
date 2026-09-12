var RescueStatus = /* @__PURE__ */ ((RescueStatus2) => {
  RescueStatus2["PENDING"] = "PENDING";
  RescueStatus2["DISPATCHED"] = "DISPATCHED";
  RescueStatus2["IN_PROGRESS"] = "IN_PROGRESS";
  RescueStatus2["RESOLVED"] = "RESOLVED";
  RescueStatus2["CANCELLED"] = "CANCELLED";
  return RescueStatus2;
})(RescueStatus || {});
var RescueSeverity = /* @__PURE__ */ ((RescueSeverity2) => {
  RescueSeverity2["CRITICAL"] = "CRITICAL";
  RescueSeverity2["HIGH"] = "HIGH";
  RescueSeverity2["MEDIUM"] = "MEDIUM";
  RescueSeverity2["LOW"] = "LOW";
  return RescueSeverity2;
})(RescueSeverity || {});
export {
  RescueSeverity,
  RescueStatus
};
