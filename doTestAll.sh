echo "01---Running tests with cocotb..."
scripts/test-cocotb.sh

echo "02---Running Woz Monitor / Integer BASIC integration tests..."
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml run --rm wozmon

echo "03---Running Dormann 6502 functional test..."
USER_UID="$(id -u)" USER_GID="$(id -g)" \
  docker compose -f docker/compose.yml run --rm dormann
