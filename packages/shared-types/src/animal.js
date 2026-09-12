var AdoptionStatus = /* @__PURE__ */ ((AdoptionStatus2) => {
  AdoptionStatus2["NOT_READY"] = "NOT_READY";
  AdoptionStatus2["AVAILABLE"] = "AVAILABLE";
  AdoptionStatus2["PENDING"] = "PENDING";
  AdoptionStatus2["ADOPTED"] = "ADOPTED";
  return AdoptionStatus2;
})(AdoptionStatus || {});
var Species = /* @__PURE__ */ ((Species2) => {
  Species2["DOG"] = "DOG";
  Species2["CAT"] = "CAT";
  Species2["BIRD"] = "BIRD";
  Species2["RABBIT"] = "RABBIT";
  Species2["OTHER"] = "OTHER";
  return Species2;
})(Species || {});
var Gender = /* @__PURE__ */ ((Gender2) => {
  Gender2["MALE"] = "MALE";
  Gender2["FEMALE"] = "FEMALE";
  Gender2["UNKNOWN"] = "UNKNOWN";
  return Gender2;
})(Gender || {});
var HealthStatus = /* @__PURE__ */ ((HealthStatus2) => {
  HealthStatus2["HEALTHY"] = "HEALTHY";
  HealthStatus2["INJURED"] = "INJURED";
  HealthStatus2["SICK"] = "SICK";
  HealthStatus2["RECOVERING"] = "RECOVERING";
  HealthStatus2["CRITICAL"] = "CRITICAL";
  return HealthStatus2;
})(HealthStatus || {});
export {
  AdoptionStatus,
  Gender,
  HealthStatus,
  Species
};
