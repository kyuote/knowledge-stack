public class Main {
    public static void main(String[] args) {
        String s = "Hello, World!";
        System.out.println(s.length());
        System.out.println(s.toUpperCase());
        System.out.println(s.substring(7,12));
        System.out.println(s.contains("World"));

        s = "hello";

        char[] res = new char[5];
        for (int i=0; i<s.length(); i++){
            res[i] = s.charAt(s.length()-1-i);
        }
        System.out.println(res);
    }
}
