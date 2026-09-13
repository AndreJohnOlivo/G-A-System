const replicaSetConfig = {
  _id: 'ucc-rs',
  members: [
    { _id: 0, host: 'mongo-primary:27017', priority: 2 },
    { _id: 1, host: 'mongo-secondary-1:27017', priority: 1 },
    { _id: 2, host: 'mongo-secondary-2:27017', priority: 1 }
  ]
};

try {
  rs.status();
  print('Replica set is already initialized.');
} catch (error) {
  printjson(rs.initiate(replicaSetConfig));
}