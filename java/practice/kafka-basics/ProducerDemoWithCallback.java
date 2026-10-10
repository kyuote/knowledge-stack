import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class ProducerDemoWithCallback {

    private static final Logger log = LoggerFactory.getLogger(ProducerDemoWithCallback.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Producer with Callback");

        Map<String, Object> config = Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092",
                // ТОЛЬКО ДЛЯ ДЕМО: маленький батч (по умолчанию 16 KB), чтобы sticky partitioner
                // быстрее переключался и было видно разные партиции. В реальном коде не ставить.
                ProducerConfig.BATCH_SIZE_CONFIG, 400
        );

        try (var producer = new KafkaProducer<>(config, new StringSerializer(), new StringSerializer())) {

            // 10 «пачек» по 30 сообщений с паузой между ними:
            // за паузу батч уходит на брокер, и sticky partitioner может переключиться на другую партицию
            for (int j = 0; j < 10; j++) {
                for (int i = 0; i < 30; i++) {
                    var record = new ProducerRecord<String, String>("demo_java", "hello world " + i);

                    // callback вызывается, когда брокер подтвердил запись или произошла ошибка
                    producer.send(record, (metadata, e) -> {
                        if (e == null) {
                            log.info("topic={} partition={} offset={} timestamp={}",
                                    metadata.topic(), metadata.partition(), metadata.offset(), metadata.timestamp());
                        } else {
                            log.error("Error while producing", e);
                        }
                    });
                }

                try {
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); // восстановить флаг прерывания и выйти
                    return;
                }
            }
        } // close() → flush: ждём, пока все записи отправятся и все callbacks отработают
    }
}
