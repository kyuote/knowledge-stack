import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class ProducerDemoKeys {

    private static final Logger log = LoggerFactory.getLogger(ProducerDemoKeys.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Producer with Keys");

        Map<String, Object> config = Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092"
        );

        try (var producer = new KafkaProducer<>(config, new StringSerializer(), new StringSerializer())) {

            // два прохода по одним и тем же ключам: видно, что ключ всегда попадает в ту же партицию
            for (int round = 0; round < 2; round++) {
                for (int i = 0; i < 10; i++) {
                    String topic = "demo_java";
                    String key = "id_" + i;
                    String value = "hello world " + i;

                    var record = new ProducerRecord<>(topic, key, value);

                    producer.send(record, (metadata, e) -> {
                        if (e == null) {
                            log.info("key={} partition={} offset={}", key, metadata.partition(), metadata.offset());
                        } else {
                            log.error("Error while producing", e);
                        }
                    });
                }
                producer.flush(); // дождаться отправки прохода, чтобы логи двух проходов не перемешались
            }
        }
    }
}
