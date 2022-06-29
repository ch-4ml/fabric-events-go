rm -rf wallet
rm debug.log

pushd ../../test-network

./network.sh down

popd