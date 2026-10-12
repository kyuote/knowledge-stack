import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;
import java.util.Map;

public class ConsumerDemo {

    private static final Logger log = LoggerFactory.getLogger(ConsumerDemo.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Consumer");

        String topic = "demo_java";

        Map<String, Object> config = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092",
                ConsumerConfig.GROUP_ID_CONFIG, "my-java-application",
                // нет закоммиченных offsets у группы → читать с начала топика
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest"
        );

        try (var consumer = new KafkaConsumer<>(config, new StringDeserializer(), new StringDeserializer())) {

            consumer.subscribe(List.of(topic));

            // бесконечный цикл чтения; остановка — кнопкой Stop в IntelliJ
            // (корректное завершение — в следующем уроке, Graceful Shutdown)
            while (true) {
                log.info("Polling");

                // ждёт данные до 1 секунды: есть данные — возвращает сразу, нет — пустой результат
                var records = consumer.poll(Duration.ofMillis(1000));

                for (var record : records) {
                    log.info("key={} value={} partition={} offset={}",
                            record.key(), record.value(), record.partition(), record.offset());
                }
            }
        }
    }
}
