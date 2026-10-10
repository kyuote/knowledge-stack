import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

public class ProducerDemo {

    private static final Logger log = LoggerFactory.getLogger(ProducerDemo.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Producer");

        // настройки продюсера: только адрес брокера, сериализаторы передаём в конструктор
        Map<String, Object> config = Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092"
        );

        // try-with-resources: close() в конце сам дождётся отправки (flush) и закроет продюсер
        try (var producer = new KafkaProducer<>(config, new StringSerializer(), new StringSerializer())) {

            var record = new ProducerRecord<String, String>("demo_java", "hello world");

            producer.send(record); // асинхронно: кладёт сообщение в буфер и сразу возвращается
        }
    }
}
