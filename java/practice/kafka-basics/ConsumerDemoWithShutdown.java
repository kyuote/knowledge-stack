import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.List;
import java.util.Map;

public class ConsumerDemoWithShutdown {

    private static final Logger log = LoggerFactory.getLogger(ConsumerDemoWithShutdown.class);

    public static void main(String[] args) {
        log.info("I am a Kafka Consumer with graceful shutdown");

        String topic = "demo_java";

        Map<String, Object> config = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092",
                ConsumerConfig.GROUP_ID_CONFIG, "my-java-application",
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest"
        );

        try (var consumer = new KafkaConsumer<>(config, new StringDeserializer(), new StringDeserializer())) {

            Thread mainThread = Thread.currentThread();

            // shutdown hook: JVM запускает его в отдельном потоке при остановке (Ctrl+C, SIGTERM, Stop)
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                log.info("Detected a shutdown, let's exit by calling consumer.wakeup()...");
                consumer.wakeup(); // poll() в main-потоке бросит WakeupException

                // ждём, пока main-поток корректно закроет консьюмер, иначе JVM завершится раньше
                try {
                    mainThread.join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));

            consumer.subscribe(List.of(topic));

            while (true) {
                log.info("Polling");

                var records = consumer.poll(Duration.ofMillis(1000));

                for (var record : records) {
                    log.info("key={} value={} partition={} offset={}",
                            record.key(), record.value(), record.partition(), record.offset());
                }
            }

        } catch (WakeupException e) {
            log.info("Consumer is starting to shut down"); // ожидаемое исключение при остановке
        } catch (Exception e) {
            log.error("Unexpected exception in the consumer", e);
        }
        // try-with-resources уже вызвал consumer.close(): коммит offsets + выход из группы
        log.info("The consumer is now gracefully shut down");
    }
}
