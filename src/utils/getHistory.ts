import {
  Address,
  AggregateTransaction,
  RepositoryFactoryHttp,
  TransactionGroup,
  TransactionType,
  TransferTransaction,
} from 'symbol-sdk';
import { firstValueFrom } from 'rxjs';
import { connectNode } from '@/utils/connectNode';
import { nodeList } from '@/consts/nodeList';
import { epochAdjustment } from '@/consts/blockchainProperty';
import { HistoryData } from '@/types/HistoryData';

export const getHistory = async (targetAddress: string): Promise<HistoryData[] | undefined> => {
  const NODE = await connectNode(nodeList);
  if (NODE === '') return undefined;
  const repo = new RepositoryFactoryHttp(NODE, {
    websocketUrl: NODE.replace('http', 'ws') + '/ws',
    websocketInjected: WebSocket,
  });
  const txRepo = repo.createTransactionRepository();
  const blockRepo = repo.createBlockRepository();

  const resultSearch = await firstValueFrom(
    txRepo.search({
      type: [TransactionType.AGGREGATE_COMPLETE],
      group: TransactionGroup.Confirmed,
      address: Address.createFromRawAddress(targetAddress),
      pageSize: 100,
    })
  );

  const resultData: HistoryData[] = [];
  for (let i = 0; i < resultSearch.data.length; i++) {
    try {
      const blockInfo = await firstValueFrom(
        blockRepo.getBlockByHeight(resultSearch.data[i].transactionInfo?.height!)
      );
      const blockCreateTime = blockInfo.timestamp.compact() + epochAdjustment * 1000; //unixtime
      const txInfo = (await firstValueFrom(
        txRepo.getTransaction(
          resultSearch.data[i].transactionInfo?.hash!,
          TransactionGroup.Confirmed
        )
      )) as AggregateTransaction;
      const tx1 = txInfo?.innerTransactions[0] as TransferTransaction; //オペレーションを記録したトランザクション
      const tx2 = txInfo?.innerTransactions[1] as TransferTransaction; //緯度を記録したトランザクション
      const tx3 = txInfo?.innerTransactions[2] as TransferTransaction; //経度を記録したトランザクション
      const histroyData: HistoryData = {
        signerAddress: tx1.signer?.address.plain()!,
        blockCreateTime: blockCreateTime,
        operation: tx1.message.payload,
        latitude: Number(tx2.message.payload),
        longitude: Number(tx3.message.payload),
        hash: txInfo.transactionInfo?.hash!,
      };
      resultData.push(histroyData);
      console.log(histroyData);
    } catch (e) {}
  }
  return resultData;
};
