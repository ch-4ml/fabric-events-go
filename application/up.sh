pushd ../../test-network

./network.sh up createChannel -c mychannel -ca

./network.sh deployCC -ccs 1 -ccv 1 -ccep "OR('Org1MSP.peer','Org2MSP.peer')"  -ccl go -ccp ../asset-transfer-events/chaincode-go/ -ccn events

popd