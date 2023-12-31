import CreepBase from "./CreepBase";

class Builder extends CreepBase {
  /** @param {Creep} creep **/
  constructor(creep) {
    super(creep);
    this.repairWalls = false;
  }
  run() {
    // Switching between modes
    if (this.creep.memory.building && this.creep.store[RESOURCE_ENERGY] === 0) {
      this.creep.memory.building = false;
      this.creep.say("🔄 collect");
    }
    if (!this.creep.memory.building && this.creep.store.getFreeCapacity() === 0) {
      this.creep.memory.building = true;
      this.creep.say("🚧 build");
    }

    if (this.creep.memory.building) {
      if (this.performBuildRole()) {
        return;
      }
      // If no construction sites, perform backup roles
      if (this.transferEnergyToExtensions()) {
        return;
      }
      if (this.transferEnergyToTowers()) {
        return;
      }
      if (this.performUpgradeRole()) {
        return;
      }
      this.moveOffRoad();
    } else {
      // Collecting logic
      // try to collect extra energy from around spawn
      if (this.collectEnergyFromGround()) {
        return;
      }
      // try to withdraw from containers or storage
      if (this.collectFromContainers()) {
        return;
      }
      this.moveOffRoad();
    }
  }
}

export default Builder;
